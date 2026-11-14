import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { AssetManifest, AssetManifestEntry } from '@/types/contracts';
import {
  manifestFilePath,
  mergeManifest,
  outputDirPath,
  resolvePipelineDir,
  syncOutputToTargets,
  writeManifest,
} from './pipeline.ts';

function targetPathToPublicUrl(targetPath: string): string {
  const trimmed = targetPath.replace(/^\/+/, '');
  return trimmed.startsWith('public/') ? `/${trimmed.slice('public/'.length)}` : `/${trimmed}`;
}

/**
 * Keeps `shared_pipeline/manifests/pending_assets.json` in sync during `vite dev`,
 * copies finished assets from `shared_pipeline/output/` into `public/assets/generated/`,
 * marks delivered entries, and notifies the client over HMR.
 */
export function emberwakeAssetPipelinePlugin(): Plugin {
  let latestManifest: AssetManifest | null = null;

  return {
    name: 'emberwake-asset-pipeline',
    apply: 'serve',
    async configureServer(server: ViteDevServer) {
      const repoRoot = server.config.root;
      const pipelineDir = resolvePipelineDir(repoRoot);
      const manifestPath = manifestFilePath(pipelineDir);
      const outputDir = outputDirPath(pipelineDir);
      const generatedDir = path.join(repoRoot, 'public', 'assets', 'generated');

      const loadEntries = async (): Promise<readonly AssetManifestEntry[]> => {
        const mod = (await server.ssrLoadModule('/src/assets/manifests/index.ts')) as {
          assetRequests: readonly AssetManifestEntry[];
        };
        return mod.assetRequests;
      };

      const reconcile = async () => {
        const entries = await loadEntries();
        const merged = mergeManifest(entries, { repoRoot, pipelineDir });
        const synced = syncOutputToTargets(merged.manifest, pipelineDir, repoRoot);
        latestManifest = synced.manifest;
        writeManifest(manifestPath, synced.manifest);

        for (const item of synced.delivered) {
          server.ws.send({
            type: 'custom',
            event: 'emberwake:asset-delivered',
            data: {
              assetId: item.assetId,
              targetPath: item.targetPath,
              url: targetPathToPublicUrl(item.targetPath),
            },
          });
        }
      };

      await reconcile();

      fs.mkdirSync(outputDir, { recursive: true });
      fs.mkdirSync(generatedDir, { recursive: true });
      server.watcher.add([outputDir, generatedDir]);

      const onFsEvent = (changedPath: string) => {
        const normalized = path.resolve(changedPath);
        if (normalized.startsWith(outputDir) || normalized.startsWith(generatedDir)) {
          if (latestManifest && normalized.startsWith(generatedDir)) {
            const match = latestManifest.assets.find((a) => path.resolve(repoRoot, a.target_path) === normalized);
            if (match) {
              server.ws.send({
                type: 'custom',
                event: 'emberwake:asset-delivered',
                data: {
                  assetId: match.asset_id,
                  targetPath: match.target_path,
                  url: targetPathToPublicUrl(match.target_path),
                },
              });
            }
          }
          void reconcile();
        }
      };

      server.watcher.on('add', onFsEvent);
      server.watcher.on('change', onFsEvent);
    },
  };
}

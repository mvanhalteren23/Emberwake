import fs from 'node:fs';
import * as nodeModule from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AssetManifestEntry } from '@/types/contracts';
import { mergeManifest, resolvePipelineDir, syncOutputToTargets, writeManifest } from './pipeline.ts';

interface ModuleHooks {
  deregister(): void;
}

interface ResolveContext {
  readonly parentURL?: string;
}

interface ResolveResult {
  readonly url: string;
  readonly shortCircuit?: boolean;
}

interface LoadResult {
  readonly format: string;
  readonly source: string | Uint8Array;
  readonly shortCircuit?: boolean;
}

interface NodeModuleWithHooks {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: ResolveContext,
      nextResolve: (specifier: string, context: ResolveContext) => ResolveResult,
    ): ResolveResult;
    load(
      url: string,
      context: Record<string, unknown>,
      nextLoad: (url: string, context: Record<string, unknown>) => LoadResult,
    ): LoadResult;
  }): ModuleHooks;
  stripTypeScriptTypes(code: string, options: { readonly mode: 'strip' | 'transform' }): string;
}

function parseArgs(argv: readonly string[]): {
  readonly onlyIds: readonly string[];
  readonly reset: boolean;
  readonly sync: boolean;
  readonly dryRun: boolean;
} {
  const onlyIds: string[] = [];
  let reset = false;
  let sync = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--reset') {
      reset = true;
    } else if (arg === '--sync') {
      sync = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--only') {
      const next = argv[i + 1];
      if (!next) throw new Error('--only requires a comma-separated list of asset IDs');
      onlyIds.push(...next.split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg?.startsWith('--only=')) {
      onlyIds.push(...arg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean));
    }
  }

  return { onlyIds, reset, sync, dryRun };
}

async function loadAssetRequests(repoRoot: string): Promise<readonly AssetManifestEntry[]> {
  const srcRoot = path.join(repoRoot, 'src');
  const modApi = nodeModule as unknown as Partial<NodeModuleWithHooks>;
  if (typeof modApi.registerHooks !== 'function' || typeof modApi.stripTypeScriptTypes !== 'function') {
    throw new Error('Node >= 22.15 with module.registerHooks and stripTypeScriptTypes is required.');
  }
  const { registerHooks, stripTypeScriptTypes } = modApi;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('@/')) {
        const candidate = path.join(srcRoot, `${specifier.slice(2)}.ts`);
        if (fs.existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith(pathToFileURL(srcRoot).href)) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const rawTarget = path.resolve(parentDir, specifier);
        if (!path.extname(rawTarget) && fs.existsSync(`${rawTarget}.ts`)) {
          return { url: pathToFileURL(`${rawTarget}.ts`).href, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(pathToFileURL(srcRoot).href) && url.endsWith('.ts')) {
        const source = fs.readFileSync(fileURLToPath(url), 'utf-8');
        const stripped = stripTypeScriptTypes(source, { mode: 'strip' });
        return { format: 'module', source: stripped, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });

  try {
    const entryUrl = pathToFileURL(path.join(srcRoot, 'assets', 'manifests', 'index.ts')).href;
    const mod = (await import(entryUrl)) as { assetRequests?: readonly AssetManifestEntry[] };
    if (!Array.isArray(mod.assetRequests)) {
      throw new Error('src/assets/manifests/index.ts must export assetRequests');
    }
    return mod.assetRequests;
  } finally {
    hooks.deregister();
  }
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const args = parseArgs(process.argv.slice(2));
  const entries = await loadAssetRequests(repoRoot);
  const pipelineDir = resolvePipelineDir(repoRoot);

  const merged = mergeManifest(entries, {
    repoRoot,
    pipelineDir,
    onlyIds: args.onlyIds,
    reset: args.reset,
  });

  let finalManifest = merged.manifest;
  let deliveredNow = 0;
  if (args.sync && !args.dryRun) {
    const synced = syncOutputToTargets(merged.manifest, pipelineDir, repoRoot);
    finalManifest = synced.manifest;
    deliveredNow = synced.delivered.length;
  }

  if (!args.dryRun) {
    writeManifest(merged.manifestPath, finalManifest);
  }

  const relOut = path.relative(repoRoot, merged.manifestPath) || merged.manifestPath;
  console.log(
    `[asset-pipeline] ${args.dryRun ? 'dry-run' : 'wrote'} ${relOut}: ` +
      `${finalManifest.assets.length} total ` +
      `(pending=${merged.counts.pending}, in_progress=${merged.counts.in_progress}, ` +
      `delivered=${merged.counts.delivered + deliveredNow}, rejected=${merged.counts.rejected})`,
  );
}

main().catch((err: unknown) => {
  console.error('[asset-pipeline] failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

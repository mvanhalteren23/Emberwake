import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assetRequests } from '@/assets/manifests';
import {
  manifestFilePath,
  mergeManifest,
  outputDirPath,
  resolvePipelineDir,
  syncOutputToTargets,
  writeManifest,
} from './pipeline';

const tempDirs: string[] = [];

function makeTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emberwake-pipeline-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('tools/asset-pipeline', () => {
  it('resolves EMBERWAKE_PIPELINE_DIR relative to repoRoot or defaults to shared_pipeline', () => {
    const root = '/tmp/emberwake-demo';
    expect(resolvePipelineDir(root, {})).toBe(path.join(root, 'shared_pipeline'));
    expect(resolvePipelineDir(root, { EMBERWAKE_PIPELINE_DIR: 'custom_pipe' })).toBe(path.join(root, 'custom_pipe'));
    expect(resolvePipelineDir(root, { EMBERWAKE_PIPELINE_DIR: '/var/tmp/pipe' })).toBe('/var/tmp/pipe');
  });

  it('preserves existing statuses and supports --only filtering', () => {
    const root = makeTempWorkspace();
    const pipelineDir = resolvePipelineDir(root, {});
    const first = assetRequests[0]!;
    const second = assetRequests[1]!;

    const mPath = manifestFilePath(pipelineDir);
    writeManifest(mPath, {
      manifest_version: '1.0',
      project: 'emberwake',
      assets: [
        { ...first, status: 'in_progress' },
        { ...second, status: 'rejected' },
      ],
    });

    const merged = mergeManifest(assetRequests, { repoRoot: root, pipelineDir });
    expect(merged.manifest.assets.find((a) => a.asset_id === first.asset_id)?.status).toBe('in_progress');
    expect(merged.manifest.assets.find((a) => a.asset_id === second.asset_id)?.status).toBe('rejected');

    const filtered = mergeManifest(assetRequests, { repoRoot: root, pipelineDir, onlyIds: [first.asset_id] });
    expect(filtered.manifest.assets).toHaveLength(1);
    expect(filtered.manifest.assets[0]?.asset_id).toBe(first.asset_id);
  });

  it('copies staged output files to target_path and marks entries delivered', () => {
    const root = makeTempWorkspace();
    const pipelineDir = resolvePipelineDir(root, {});
    const targetEntry = assetRequests.find((a) => a.asset_id === 'qte.prompt.tap')!;
    const outDir = outputDirPath(pipelineDir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${targetEntry.asset_id}.png`), Buffer.from('fake-png-bytes'));

    const merged = mergeManifest([targetEntry], { repoRoot: root, pipelineDir });
    const synced = syncOutputToTargets(merged.manifest, pipelineDir, root);

    expect(synced.delivered).toEqual([{ assetId: targetEntry.asset_id, targetPath: targetEntry.target_path }]);
    expect(synced.manifest.assets[0]?.status).toBe('delivered');
    expect(fs.existsSync(path.join(root, targetEntry.target_path))).toBe(true);
  });
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('导出按钮在空闲时实际调用导出函数', () => {
    assert.match(
        html,
        /@click="isExportingAudio\s*\?\s*cancelAudioExport\(\)\s*:\s*exportAudio\(\)"/
    );
});

test('均衡和沉浸正式分支在创建 OfflineAudioContext 或 Web Audio 空间链之前返回', () => {
    const branchStart = html.indexOf("if (exportSpatialProfile !== 'standard')");
    const branchEnd = html.indexOf('\n                        // currentTime 是离线工程时间轴上的秒数游标。', branchStart);
    assert.ok(branchStart > 0 && branchEnd > branchStart);
    const formalBranch = html.slice(branchStart, branchEnd);
    assert.match(formalBranch, /compileRenderManifest/);
    assert.match(formalBranch, /steamAudioClient\.renderSpatialAudio/);
    assert.match(formalBranch, /return;/);
    assert.doesNotMatch(formalBranch, /OfflineAudioContext|connectSpatialNodeChain|bufferToWave/);
});

test('标准路径继续调用兼容预混接口', () => {
    assert.match(html, /spatialAudioClient\.exportSpatialAudio/);
    assert.match(html, /profile: exportSpatialProfile/);
});

test('正式导出把后端进度写入可访问的阶段文本和进度条', () => {
    assert.match(html, /role="progressbar"/);
    assert.match(html, /:aria-valuenow="audioExportProgress\.progress"/);
    assert.match(html, /onProgress:\s*\(progress\)\s*=>/);
    assert.match(html, /audioExportProgress\.value\s*=\s*progress/);
    assert.match(html, /exportStatus\.value\s*=\s*progress\.message/);
});

test('音频导出使用函数级单飞锁防止重复提交', () => {
    assert.match(html, /let audioExportInFlight\s*=\s*false/);
    assert.match(html, /if \(audioExportInFlight\) return/);
    assert.match(html, /audioExportInFlight\s*=\s*true/);
    assert.match(html, /finally[\s\S]*audioExportInFlight\s*=\s*false/);
});

test('正式与标准分支统一通过近期结果去重入口下载', () => {
    const exportStart = html.indexOf('const exportAudio = async () =>');
    const exportEnd = html.indexOf('\n                };', exportStart);
    assert.ok(exportStart > 0 && exportEnd > exportStart);
    const exportSource = html.slice(exportStart, exportEnd);
    assert.equal((exportSource.match(/downloadAudioExportResult\(/g) || []).length, 2);
    assert.doesNotMatch(exportSource, /createObjectURL|\.click\(\)/);
});

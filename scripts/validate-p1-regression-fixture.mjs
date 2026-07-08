import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function loadProjectStorage() {
    const storagePath = path.join(rootDir, 'project-storage.js');
    const storageSource = fs.readFileSync(storagePath, 'utf8');
    const context = {
        window: {},
        console,
        Date,
        Math,
        JSON,
        Array,
        Number,
        String,
        Object,
        Map,
        Set
    };

    vm.createContext(context);
    vm.runInContext(storageSource, context, { filename: 'project-storage.js' });

    const storage = context.window.UnitaleProjectStorage;
    assert.ok(storage, 'project-storage.js 没有暴露 UnitaleProjectStorage');
    return storage;
}

function main() {
    const fixturePath = path.join(rootDir, 'fixtures', 'p1-minimal-regression-project-v3.json');
    const fixtureText = fs.readFileSync(fixturePath, 'utf8');
    const rawFixture = JSON.parse(fixtureText);
    const {
        normalizeProjectEnvelope,
        PROJECT_KIND,
        PROJECT_SCHEMA_VERSION
    } = loadProjectStorage();

    assert.equal(rawFixture.kind, PROJECT_KIND, 'fixture kind 不正确');
    assert.equal(rawFixture.schemaVersion, PROJECT_SCHEMA_VERSION, 'fixture schemaVersion 不正确');

    for (const key of ['_fileData', 'audioBase64', 'imageBase64']) {
        assert.ok(
            fixtureText.includes(`"${key}":"data:`),
            `fixture 中的 ${key} 必须保持无空格的 data URI 形式，供导入正则提取`
        );
    }

    const normalized = normalizeProjectEnvelope(rawFixture);
    assert.equal(normalized.kind, PROJECT_KIND, '规范化后的 kind 不正确');
    assert.equal(normalized.schemaVersion, PROJECT_SCHEMA_VERSION, '规范化后的 schemaVersion 不正确');
    assert.equal(normalized.libraries.sfx.length, 1, '应包含 1 个 SFX');
    assert.equal(normalized.libraries.bgm.length, 1, '应包含 1 个 BGM');
    assert.equal(normalized.libraries.timbres.length, 1, '应包含 1 个音色');
    assert.equal(normalized.libraries.filters.length, 4, '应包含 4 个默认滤波器');
    assert.equal(normalized.libraries.emotions.length, 8, '应包含 8 个系统情绪');
    assert.equal(normalized.project.scriptList.length, 1, '应只包含 1 个脚本');
    assert.equal(normalized.project.currentScriptId, 'regression-main', 'currentScriptId 不符合预期');

    const [script] = normalized.project.scriptList;
    assert.equal(script.id, 'regression-main', '脚本 ID 不符合预期');
    assert.equal(script.data.characters.length, 1, '应只包含 1 个角色');

    const [character] = script.data.characters;
    const [timbre] = normalized.libraries.timbres;
    assert.equal(character.name, '旁白', '角色名称不符合预期');
    assert.equal(character.voiceAssetKey, timbre.assetKey, '角色音色映射未对齐音色库 assetKey');
    assert.equal(character.voiceFile, timbre.refPath, '角色音色路径未对齐音色库 refPath');

    const lines = script.data.scriptLines;
    const dialogueLines = lines.filter((line) => line.type === 'dialogue');
    const bgmLines = lines.filter((line) => line.type === 'bgm');
    const bgImageLines = lines.filter((line) => line.type === 'bgImage');
    const sfxNames = new Set(normalized.libraries.sfx.map((item) => item.name));
    const bgmNames = new Set(normalized.libraries.bgm.map((item) => item.name));

    assert.equal(lines.length, 5, '应包含 5 个脚本块');
    assert.deepEqual(
        dialogueLines.map((line) => line.id),
        ['regression_line_1', 'regression_line_2'],
        '台词行 ID 不符合预期'
    );
    assert.equal(dialogueLines.length, 2, '应包含 2 条台词');
    assert.equal(bgImageLines.length, 1, '应包含 1 个背景图片块');
    assert.ok(bgmLines.some((line) => line.action === 'play'), '应包含 1 个 BGM 播放块');
    assert.ok(bgmLines.some((line) => line.action === 'stop'), '应包含 1 个 BGM 停止块');
    assert.ok(dialogueLines.every((line) => line.audioAssetKey), '每条台词都必须带 audioAssetKey');
    assert.ok(dialogueLines.every((line) => line.role === '旁白'), '两条台词都应归属旁白');
    assert.ok(dialogueLines[0].sfx.every((item) => sfxNames.has(item.name)), '首条台词引用了不存在的音效');
    assert.ok(bgmLines.some((line) => bgmNames.has(line.bgmName)), 'BGM 播放块未引用资源库中的 BGM');
    assert.equal(bgImageLines[0].bgImageAssetKey, 'bgImage_regression_cover_asset', '背景图 assetKey 不符合预期');

    const rawLines = rawFixture.project.scriptList[0].data.scriptLines;
    assert.ok(
        rawLines
            .filter((line) => line.type === 'dialogue')
            .every((line) => typeof line.audioBase64 === 'string' && line.audioBase64.startsWith('data:audio/wav;base64,')),
        '原始 fixture 中的台词音频必须是内嵌 WAV data URI'
    );
    assert.ok(
        rawLines.some((line) => line.type === 'bgImage' && typeof line.imageBase64 === 'string' && line.imageBase64.startsWith('data:image/png;base64,')),
        '原始 fixture 中的背景图必须是内嵌 PNG data URI'
    );
    assert.ok(
        rawFixture.libraries.timbres.every((item) => typeof item._fileData === 'string' && item._fileData.startsWith('data:audio/wav;base64,')),
        '音色库 fixture 必须内嵌音频'
    );

    console.log('fixture validation ok');
    console.log(
        `libraries: sfx=${normalized.libraries.sfx.length}, bgm=${normalized.libraries.bgm.length}, timbres=${normalized.libraries.timbres.length}, filters=${normalized.libraries.filters.length}, emotions=${normalized.libraries.emotions.length}`
    );
    console.log(
        `lines: total=${lines.length}, dialogue=${dialogueLines.length}, bgm=${bgmLines.length}, bgImage=${bgImageLines.length}`
    );
}

try {
    main();
} catch (error) {
    console.error('fixture validation failed');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}

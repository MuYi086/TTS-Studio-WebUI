const assert = require('node:assert/strict');
const test = require('node:test');

global.window = global;
global.UnitaleSpatialSchema = require('./spatial-schema.js');
require('./project-storage.js');

const storage = global.UnitaleProjectStorage;

test('schema v4 导入在唯一持久化入口补齐 dialogue、SFX 与 BGM 空间语义', () => {
    const project = storage.normalizeProjectEnvelope({
        project: {
            scriptList: [{
                id: 'default',
                data: {
                    characters: [{ name: '旁白' }],
                    scriptLines: [
                        {
                            id: 'line-1', type: 'dialogue', role: '旁白', text: '测试',
                            sfx_plan: [{ id: 'door', prompt: '门响', purpose: 'foreground_action' }]
                        },
                        { id: 'bgm-1', type: 'bgm', action: 'play', bgmName: '床' }
                    ]
                }
            }]
        }
    });
    const lines = project.project.scriptList[0].data.scriptLines;
    assert.equal(project.schemaVersion, 4);
    assert.equal(lines[0].spatial.location, 'front_center');
    assert.equal(lines[0].sfx_plan[0].spatial.mode, 'point');
    assert.equal(lines[1].spatial.mode, 'preserve_stereo');
});

test('不同角色的默认锚点稳定分布且同角色跨句保持一致', () => {
    const project = storage.normalizeProjectEnvelope({
        project: { scriptList: [{ id: 'default', data: { scriptLines: [
            { id: 'a1', type: 'dialogue', role: '甲', text: '一' },
            { id: 'b1', type: 'dialogue', role: '乙', text: '二' },
            { id: 'a2', type: 'dialogue', role: '甲', text: '三' }
        ] } }] }
    });
    const lines = project.project.scriptList[0].data.scriptLines;
    assert.equal(lines[0].spatial.location, 'front_left');
    assert.equal(lines[1].spatial.location, 'front_right');
    assert.equal(lines[2].spatial.location, lines[0].spatial.location);
});

test('导出清除运行时字段但保留有限空间语义', () => {
    const exported = storage.stripRuntimeProjectEnvelope({
        project: {
            scriptList: [{
                id: 'default',
                data: {
                    scriptLines: [{
                        id: 'line-1', type: 'dialogue', role: '甲', text: '你好', audioUrl: 'blob:test',
                        spatial: { mode: 'point', location: 'rear_right', source: 'user' }
                    }]
                }
            }]
        }
    });
    const line = exported.project.scriptList[0].data.scriptLines[0];
    assert.equal(line.audioUrl, undefined);
    assert.equal(line.spatial.location, 'rear_right');
    assert.equal(line.spatial.source, 'user');
});

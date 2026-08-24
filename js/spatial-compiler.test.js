const assert = require('node:assert/strict');
const test = require('node:test');

global.UnitaleSpatialSchema = require('./spatial-schema.js');
const compiler = require('./spatial-compiler.js');

test('编译器保持裁剪、倍速、停顿、SFX 负偏移和独立对象边界', () => {
    const result = compiler.compileRenderManifest({
        profile: 'immersive',
        characters: [{ name: '甲', volume: 0.5 }],
        scriptLines: [{
            id: 'line-1', type: 'dialogue', role: '甲', audioAssetKey: 'dialogue-key',
            trimStart: 0.1, trimEnd: 0.9, speed: 2, dialogueVolume: 0.8,
            sfxVolume: 1, break_duration: 0.25,
            spatial: { location: 'front_left', source: 'user' },
            sfx_plan: [{
                audioAssetKey: 'sfx-key', anchor: 'dialogue_start', offset_ms: -500,
                mix_preset: 'cue_before_dialogue', purpose: 'foreground_action',
                spatial: { location: 'rear_left', movement: 'approaching', source: 'llm' }
            }]
        }],
        assetsByKey: {
            'dialogue-key': { durationMs: 10000, filename: 'line.wav' },
            'sfx-key': { durationMs: 1200, filename: 'effect.wav' }
        }
    });

    assert.equal(result.manifest.sources.length, 2);
    const [dialogue, sfx] = result.manifest.sources;
    assert.equal(dialogue.start_ms, 550);
    assert.equal(dialogue.trim_start_ms, 1000);
    assert.equal(dialogue.duration_ms, 4000);
    assert.equal(dialogue.playback_rate, 2);
    assert.equal(dialogue.spatial.location, 'front_left');
    assert.equal(sfx.start_ms, 50);
    assert.equal(sfx.duration_ms, 1200);
    assert.equal(sfx.spatial.movement, 'approaching');
    assert.equal(result.assetRequests.length, 2);
    assert.notEqual(dialogue.asset_filename, sfx.asset_filename);
    assert.match(dialogue.asset_filename, /^asset_[0-9a-f]{8}\.wav$/);
    assert.equal(result.manifest.timeline_duration_ms, 5800);
});

test('BGM 被编译为循环且保留立体声，不与对白预混', () => {
    const result = compiler.compileRenderManifest({
        profile: 'balanced',
        scriptLines: [
            { type: 'bgm', action: 'play', bgmName: '床', audioAssetKey: 'bgm-key', volume: 0.5 },
            { type: 'dialogue', role: '旁白', audioAssetKey: 'voice-key', break_duration: 0, sfx_plan: [] },
            { type: 'bgm', action: 'stop' }
        ],
        bgmLibrary: [{ name: '床', assetKey: 'bgm-key', volume: 0.4, trimStart: 0.2 }],
        assetsByKey: {
            'voice-key': { durationMs: 1000 },
            'bgm-key': { durationMs: 8000 }
        }
    });
    const bgm = result.manifest.sources.find((source) => source.kind === 'bgm');
    assert.ok(bgm);
    assert.equal(bgm.loop, true);
    assert.equal(bgm.spatial.mode, 'preserve_stereo');
    assert.equal(bgm.trim_start_ms, 1600);
    assert.equal(result.assetRequests.length, 2);
});

test('没有任何可用对象时拒绝生成空 Manifest', () => {
    assert.throws(() => compiler.compileRenderManifest({ scriptLines: [], assetsByKey: {} }), /没有可用于/);
});

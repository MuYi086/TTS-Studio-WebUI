const assert = require('node:assert/strict');
const test = require('node:test');

const schema = require('./spatial-schema.js');

test('旁白与 BGM 使用安全且可兑现的默认空间计划', () => {
    assert.deepEqual(schema.createDefaultSpatialPlan('narrator'), {
        mode: 'point', location: 'front_center', distance: 'conversational', movement: 'static',
        occlusion: 'none', spatial_blend: 'subtle', source: 'default'
    });
    assert.equal(schema.normalizeSpatialPlan('bgm', { mode: 'point' }).mode, 'preserve_stereo');
});

test('未知枚举和未实现遮挡不会透传到底层 renderer', () => {
    const plan = schema.normalizeSpatialPlan('sfx', {
        mode: 'raw_dsp', location: 'somewhere', occlusion: 'concrete_wall', source: 'llm'
    });
    assert.equal(plan.mode, 'point');
    assert.equal(plan.location, 'front_center');
    assert.equal(plan.occlusion, 'none');
    assert.equal(plan.source, 'llm');
    assert.equal(Object.prototype.hasOwnProperty.call(plan, 'x'), false);
});

test('角色默认锚点只由稳定顺序决定', () => {
    const first = schema.createDefaultSpatialPlan('dialogue', { role: '甲', roleIndex: 0 });
    const second = schema.createDefaultSpatialPlan('dialogue', { role: '乙', roleIndex: 1 });
    assert.equal(first.location, 'front_left');
    assert.equal(second.location, 'front_right');
});

test('缺少 LLM 计划时从明确 SFX 文字生成确定性规则回退', () => {
    const plan = schema.normalizeSpatialPlan('sfx', null, {
        text: '身后远处的脚步声由远及近，越来越清晰'
    });
    assert.equal(plan.location, 'rear_center');
    assert.equal(plan.distance, 'far');
    assert.equal(plan.movement, 'approaching');
    assert.equal(plan.source, 'rule');
});

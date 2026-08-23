const assert = require('node:assert/strict');
const test = require('node:test');

global.window = global;
require('./spatial-timeline.js');

const spatialTimeline = global.UnitaleSpatialTimeline;

test('standard 档位不改变对象方位、距离或空间湿声', () => {
    const plan = spatialTimeline.createDialoguePlan({
        line: { role: '林夏', text: '我就在这里。' },
        eventIndex: 3,
        rolePositions: { 林夏: 0.6 },
        profile: 'standard'
    });

    assert.deepEqual(plan, {
        panStart: 0,
        panEnd: 0,
        gainStart: 1,
        gainEnd: 1,
        cutoffStart: 20000,
        cutoffEnd: 20000,
        roomStart: 0,
        roomEnd: 0
    });
});

test('角色位置在整条时间线中保持稳定且分布在左右两侧', () => {
    const lines = [
        { role: '旁白' },
        { role: '林夏' },
        { role: '周远' },
        { role: '林夏' }
    ];
    const positions = spatialTimeline.createRolePositions(lines, 'immersive');

    assert.equal(positions['旁白'], 0);
    assert.ok(positions['林夏'] < 0);
    assert.ok(positions['周远'] > 0);
    assert.equal(
        positions['林夏'],
        spatialTimeline.createRolePositions(lines, 'immersive')['林夏']
    );
});

test('沉浸档对白在角色锚点附近做连续的声像和距离变化', () => {
    const rolePositions = { 林夏: -0.55 };
    const first = spatialTimeline.createDialoguePlan({
        line: { role: '林夏', text: '风从走廊里吹来。' },
        eventIndex: 2,
        rolePositions,
        profile: 'immersive'
    });
    const next = spatialTimeline.createDialoguePlan({
        line: { role: '林夏', text: '门缓缓打开了。' },
        eventIndex: 3,
        rolePositions,
        profile: 'immersive'
    });

    assert.ok(first.panStart < 0 && first.panEnd < 0);
    assert.ok(Math.abs(first.panEnd - first.panStart) > 0.02);
    assert.ok(Math.abs(first.gainEnd - first.gainStart) > 0.02);
    assert.ok(Math.abs(next.panStart - first.panStart) < 0.35);
    assert.notEqual(next.gainEnd, first.gainEnd);
});

test('明确的移动与距离词会覆盖默认轨迹', () => {
    const crossing = spatialTimeline.createSoundEffectPlan({
        plan: { prompt: '脚步声从左侧快速移动到右侧' },
        eventIndex: 0,
        profile: 'immersive'
    });
    const approaching = spatialTimeline.createSoundEffectPlan({
        plan: { prompt: '远处的汽车轰鸣由远及近，越来越响' },
        eventIndex: 1,
        profile: 'immersive'
    });

    assert.ok(crossing.panStart < -0.7);
    assert.ok(crossing.panEnd > 0.7);
    assert.ok(approaching.gainStart < approaching.gainEnd);
    assert.ok(approaching.cutoffStart < approaching.cutoffEnd);
    assert.ok(approaching.roomStart > approaching.roomEnd);
});

test('左侧远处静态音效同时体现方位、响度、高频和反射变化', () => {
    const plan = spatialTimeline.createSoundEffectPlan({
        plan: { prompt: '左侧远处走廊传来的沉闷脚步声' },
        eventIndex: 4,
        profile: 'balanced'
    });

    assert.ok(plan.panStart < -0.55 && plan.panEnd < -0.55);
    assert.ok(plan.gainStart < 0.8 && plan.gainEnd < 0.8);
    assert.ok(plan.cutoffStart < 9000 && plan.cutoffEnd < 9000);
    assert.ok(plan.roomStart >= 0.12 && plan.roomEnd >= 0.12);
});

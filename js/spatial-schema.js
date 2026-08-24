/**
 * @fileoverview 空间语义 DSL 的有限枚举、默认值与唯一规范化实现。
 */
(function (global) {
    const ENUMS = Object.freeze({
        mode: Object.freeze(['dry_center', 'point', 'preserve_stereo']),
        location: Object.freeze([
            'front_center', 'front_left', 'front_right', 'side_left', 'side_right',
            'rear_left', 'rear_center', 'rear_right', 'above_front', 'above_rear', 'below_front'
        ]),
        distance: Object.freeze(['intimate', 'near', 'conversational', 'mid', 'far']),
        movement: Object.freeze([
            'static', 'approaching', 'receding', 'left_to_right', 'right_to_left',
            'front_to_rear', 'rear_to_front', 'rising', 'falling'
        ]),
        occlusion: Object.freeze([
            'none', 'wooden_door', 'solid_door', 'drywall', 'concrete_wall', 'floor_ceiling'
        ]),
        spatial_blend: Object.freeze(['subtle', 'medium', 'strong', 'full']),
        source: Object.freeze(['default', 'rule', 'llm', 'user'])
    });

    const LABELS = Object.freeze({
        mode: Object.freeze({ dry_center: '居中干声', point: '点声源', preserve_stereo: '保留立体声' }),
        location: Object.freeze({
            front_center: '正前', front_left: '左前', front_right: '右前', side_left: '左侧', side_right: '右侧',
            rear_left: '左后', rear_center: '正后', rear_right: '右后', above_front: '前上', above_rear: '后上', below_front: '前下'
        }),
        distance: Object.freeze({ intimate: '贴近', near: '近', conversational: '对话距离', mid: '中距', far: '远' }),
        movement: Object.freeze({
            static: '静止', approaching: '接近', receding: '远离', left_to_right: '左到右', right_to_left: '右到左',
            front_to_rear: '前到后', rear_to_front: '后到前', rising: '上升', falling: '下降'
        }),
        spatial_blend: Object.freeze({ subtle: '轻微', medium: '中等', strong: '明显', full: '完全' })
    });

    function pick(field, value, fallback) {
        return ENUMS[field].includes(value) ? value : fallback;
    }

    function roleLocation(role, roleIndex) {
        if (!role || role === '旁白' || /^narrator$/i.test(role)) return 'front_center';
        const positions = ['front_left', 'front_right', 'side_left', 'side_right'];
        return positions[Math.max(0, Number(roleIndex) || 0) % positions.length];
    }

    function inferSoundEffectPlan(text) {
        const cue = String(text || '').toLowerCase();
        const inferred = {};
        if (/(身后|背后|后方|rear|behind)/i.test(cue)) inferred.location = 'rear_center';
        else if (/(楼上|上方|头顶|above|overhead|upstairs)/i.test(cue)) inferred.location = 'above_front';
        else if (/(楼下|下方|脚下|below|downstairs)/i.test(cue)) inferred.location = 'below_front';
        else if (/(左侧|左边|from the left|on the left)/i.test(cue)) inferred.location = 'side_left';
        else if (/(右侧|右边|from the right|on the right)/i.test(cue)) inferred.location = 'side_right';

        if (/(由远及近|越来越近|靠近|接近|approach|coming closer)/i.test(cue)) inferred.movement = 'approaching';
        else if (/(由近及远|越来越远|离开|远去|reced|moving away)/i.test(cue)) inferred.movement = 'receding';
        else if (/(从左.{0,8}(到|向)右|left.{0,16}right)/i.test(cue)) inferred.movement = 'left_to_right';
        else if (/(从右.{0,8}(到|向)左|right.{0,16}left)/i.test(cue)) inferred.movement = 'right_to_left';

        if (/(远处|远方|distant|far away)/i.test(cue)) inferred.distance = 'far';
        else if (/(近距离|耳边|贴近|close-miked|close by)/i.test(cue)) inferred.distance = 'near';
        return inferred;
    }

    /**
     * 生成一种对象类型的安全默认计划。所有输出均为有限语义，不包含坐标或 DSP 数值。
     * @param {string} kind 对象类型
     * @param {Object} [context] 角色等稳定上下文
     * @returns {Object} 完整空间计划
     */
    function createDefaultSpatialPlan(kind, context) {
        const safeKind = kind || 'dialogue';
        const details = context || {};
        if (safeKind === 'bgm') {
            return {
                mode: 'preserve_stereo', location: 'front_center', distance: 'conversational',
                movement: 'static', occlusion: 'none', spatial_blend: 'subtle', source: 'default'
            };
        }
        if (safeKind === 'ambience') {
            return {
                mode: 'point', location: 'front_center', distance: 'mid', movement: 'static',
                occlusion: 'none', spatial_blend: 'medium', source: 'default'
            };
        }
        if (safeKind === 'narrator') {
            return {
                mode: 'point', location: 'front_center', distance: 'conversational', movement: 'static',
                occlusion: 'none', spatial_blend: 'subtle', source: 'default'
            };
        }
        const inferred = safeKind === 'sfx' ? inferSoundEffectPlan(details.text) : {};
        return {
            mode: 'point',
            location: inferred.location || (safeKind === 'dialogue' ? roleLocation(details.role, details.roleIndex) : 'front_center'),
            distance: inferred.distance || (safeKind === 'sfx' ? 'mid' : 'conversational'),
            movement: inferred.movement || 'static',
            occlusion: 'none',
            spatial_blend: safeKind === 'sfx' ? 'strong' : 'medium',
            source: Object.keys(inferred).length > 0 ? 'rule' : 'default'
        };
    }

    /** 只保留 v1 renderer 能兑现的字段和枚举；未知输入回退而不是透传。 */
    function normalizeSpatialPlan(kind, value, context) {
        const defaults = createDefaultSpatialPlan(kind, context);
        const source = value && typeof value === 'object' ? value : {};
        const normalized = {
            mode: pick('mode', source.mode, defaults.mode),
            location: pick('location', source.location, defaults.location),
            distance: pick('distance', source.distance, defaults.distance),
            movement: pick('movement', source.movement, defaults.movement),
            // renderer v1 尚未实现遮挡，持久化入口明确降级为 none。
            occlusion: 'none',
            spatial_blend: pick('spatial_blend', source.spatial_blend, defaults.spatial_blend),
            source: pick(
                'source',
                source.source,
                Object.keys(source).length > 0 ? 'user' : defaults.source
            )
        };
        if (kind === 'bgm') normalized.mode = 'preserve_stereo';
        if (!['bgm', 'ambience'].includes(kind) && normalized.mode === 'preserve_stereo') {
            normalized.mode = defaults.mode;
        }
        return normalized;
    }

    const api = { ENUMS, LABELS, createDefaultSpatialPlan, inferSoundEffectPlan, normalizeSpatialPlan };
    global.UnitaleSpatialSchema = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));

/**
 * @fileoverview TTS Studio 导出时间线的对象级动态空间规划
 * @description
 * - 为对白角色建立稳定的左右位置，避免逐句随机跳动
 * - 从 SoundEffect 提示词和对白控制指令提取方位、远近与移动线索
 * - 把声像、距离增益、高频衰减和早期反射作为连续 Web Audio 自动化曲线
 * @module spatial-timeline
 */
(function exposeSpatialTimeline(global) {
    'use strict';

    const TWO_PI = Math.PI * 2;
    const NARRATOR_PATTERN = /^(旁白|叙述者|解说|narrator|narration)$/i;
    const LEFT_TO_RIGHT_PATTERN = /(从|由)?左(?:侧|边|方|耳)?[^，。；;]{0,12}(向|到|移向|掠向|穿过)[^，。；;]{0,6}右(?:侧|边|方|耳)?|left[^,.；;]{0,20}(to|towards?)[^,.；;]{0,8}right/i;
    const RIGHT_TO_LEFT_PATTERN = /(从|由)?右(?:侧|边|方|耳)?[^，。；;]{0,12}(向|到|移向|掠向|穿过)[^，。；;]{0,6}左(?:侧|边|方|耳)?|right[^,.；;]{0,20}(to|towards?)[^,.；;]{0,8}left/i;
    const LEFT_PATTERN = /左(?:侧|边|方|耳)|\bleft\b/i;
    const RIGHT_PATTERN = /右(?:侧|边|方|耳)|\bright\b/i;
    const APPROACH_PATTERN = /由远及近|从远处?(?:向|到|移向)?近处?|越来越近|逐渐靠近|逼近|接近|迎面而来|approach|coming closer|draw(?:s|ing)? near/i;
    const RECEDE_PATTERN = /由近及远|从近处?(?:向|到|移向)?远处?|越来越远|逐渐远去|渐行渐远|离去|远离|reced|moving away|fade(?:s|d|ing)? into the distance/i;
    const NEAR_PATTERN = /耳边|耳畔|贴近|近在咫尺|近处|身旁|低声|轻声|耳语|呢喃|close[- ]?miked|close by|nearby|whisper/i;
    const FAR_PATTERN = /远处|远方|远远|门外|楼下|走廊尽头|隔壁|隔着|身后|背后|遥远|distant|far away|in the distance|behind|down the hall/i;

    const PROFILE_SETTINGS = Object.freeze({
        balanced: Object.freeze({
            roleSlots: Object.freeze([-0.36, 0.36, -0.54, 0.54, -0.2, 0.2]),
            roleDrift: 0.09,
            narratorDrift: 0.035,
            distanceMin: 0.18,
            distanceSpan: 0.44,
            nearGain: 1,
            farGain: 0.66,
            nearCutoff: 19500,
            farCutoff: 5600,
            nearRoom: 0.025,
            farRoom: 0.15,
            explicitPan: 0.7,
            crossingPan: 0.82,
            reflectionDelay: 0.019
        }),
        immersive: Object.freeze({
            roleSlots: Object.freeze([-0.56, 0.56, -0.78, 0.78, -0.3, 0.3]),
            roleDrift: 0.19,
            narratorDrift: 0.085,
            distanceMin: 0.08,
            distanceSpan: 0.78,
            nearGain: 1.05,
            farGain: 0.44,
            nearCutoff: 19500,
            farCutoff: 3000,
            nearRoom: 0.035,
            farRoom: 0.27,
            explicitPan: 0.88,
            crossingPan: 0.96,
            reflectionDelay: 0.024
        })
    });

    const NEUTRAL_PLAN = Object.freeze({
        panStart: 0,
        panEnd: 0,
        gainStart: 1,
        gainEnd: 1,
        cutoffStart: 20000,
        cutoffEnd: 20000,
        roomStart: 0,
        roomEnd: 0
    });

    /** 将数值限制在安全范围内。 */
    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, Number(value) || 0));
    }

    /** 生成跨浏览器一致的轻量字符串哈希，空间轨迹不依赖随机数。 */
    function stableUnitHash(value) {
        let hash = 2166136261;
        const text = String(value || '');
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0) / 4294967295;
    }

    /** 判断角色是否属于应保持前方中心的旁白。 */
    function isNarrator(role) {
        return NARRATOR_PATTERN.test(String(role || '').trim());
    }

    /** 返回档位配置；standard 由调用入口直接走无损旁路。 */
    function getSettings(profile) {
        return PROFILE_SETTINGS[profile] || PROFILE_SETTINGS.balanced;
    }

    /**
     * 为脚本角色分配稳定的左右锚点。
     * @param {Array<Object>} lines - 含 role 字段的对白列表
     * @param {string} profile - 导出空间档位
     * @returns {Object<string, number>} 角色名到声像锚点的映射
     */
    function createRolePositions(lines, profile) {
        const positions = {};
        if (profile === 'standard') return positions;
        const settings = getSettings(profile);
        let roleIndex = 0;
        (lines || []).forEach((line) => {
            const role = String(line && line.role || '').trim();
            if (!role || Object.hasOwn(positions, role)) return;
            if (isNarrator(role)) {
                positions[role] = 0;
                return;
            }
            const slot = settings.roleSlots[roleIndex % settings.roleSlots.length];
            const ring = Math.floor(roleIndex / settings.roleSlots.length);
            positions[role] = clamp(slot * Math.max(0.72, 1 - ring * 0.12), -0.9, 0.9);
            roleIndex += 1;
        });
        return positions;
    }

    /** 从自然语言中提取只影响空间处理的线索。 */
    function parseSpatialCues(value) {
        const text = String(value || '');
        return {
            leftToRight: LEFT_TO_RIGHT_PATTERN.test(text),
            rightToLeft: RIGHT_TO_LEFT_PATTERN.test(text),
            left: LEFT_PATTERN.test(text),
            right: RIGHT_PATTERN.test(text),
            approaching: APPROACH_PATTERN.test(text),
            receding: RECEDE_PATTERN.test(text),
            near: NEAR_PATTERN.test(text),
            far: FAR_PATTERN.test(text)
        };
    }

    /** 把 0（近）到 1（远）的距离转换为可听见但不过度的声学变化。 */
    function distanceValues(distance, settings) {
        const normalized = clamp(distance, 0, 1);
        return {
            gain: settings.nearGain + (settings.farGain - settings.nearGain) * normalized,
            cutoff: settings.nearCutoff * Math.pow(settings.farCutoff / settings.nearCutoff, normalized),
            room: settings.nearRoom + (settings.farRoom - settings.nearRoom) * normalized
        };
    }

    /** 保证公开计划的所有 Web Audio 参数都在安全范围内。 */
    function normalizePlan(plan) {
        return {
            panStart: clamp(plan.panStart, -1, 1),
            panEnd: clamp(plan.panEnd, -1, 1),
            gainStart: clamp(plan.gainStart, 0.25, 1.2),
            gainEnd: clamp(plan.gainEnd, 0.25, 1.2),
            cutoffStart: clamp(plan.cutoffStart, 1200, 20000),
            cutoffEnd: clamp(plan.cutoffEnd, 1200, 20000),
            roomStart: clamp(plan.roomStart, 0, 0.35),
            roomEnd: clamp(plan.roomEnd, 0, 0.35)
        };
    }

    /**
     * 根据锚点、事件序号和文本线索生成连续的对象轨迹。
     * 正弦相位只用于平滑漂移；同一角色的锚点不会被事件序号重新分配。
     */
    function createMotionPlan({ anchor, identity, eventIndex, cues, profile, narrator = false }) {
        const settings = getSettings(profile);
        const phase = stableUnitHash(identity) * TWO_PI + Math.max(0, Number(eventIndex) || 0) * 0.72;
        const nextPhase = phase + 0.62;
        const drift = narrator ? settings.narratorDrift : settings.roleDrift;
        let panStart = anchor + Math.sin(phase) * drift;
        let panEnd = anchor + Math.sin(nextPhase) * drift;
        let distanceStart = settings.distanceMin + (0.5 + 0.5 * Math.sin(phase * 0.73)) * settings.distanceSpan;
        let distanceEnd = settings.distanceMin + (0.5 + 0.5 * Math.sin(nextPhase * 0.73)) * settings.distanceSpan;

        if (cues.leftToRight) {
            panStart = -settings.crossingPan;
            panEnd = settings.crossingPan;
        } else if (cues.rightToLeft) {
            panStart = settings.crossingPan;
            panEnd = -settings.crossingPan;
        } else if (cues.left && !cues.right) {
            panStart = -settings.explicitPan;
            panEnd = -settings.explicitPan + Math.sin(nextPhase) * drift * 0.45;
        } else if (cues.right && !cues.left) {
            panStart = settings.explicitPan;
            panEnd = settings.explicitPan + Math.sin(nextPhase) * drift * 0.45;
        }

        // 正弦轨迹靠近转折点时起止值可能过于接近；补足很小的连续位移，避免整句听成固定声像。
        if (!cues.leftToRight && !cues.rightToLeft && Math.abs(panEnd - panStart) < drift * 0.25) {
            panEnd = panStart + (Math.cos(phase) >= 0 ? 1 : -1) * drift * 0.25;
        }

        if (cues.approaching && !cues.receding) {
            distanceStart = 0.94;
            distanceEnd = 0.08;
            if (!cues.leftToRight && !cues.rightToLeft) panEnd *= 0.45;
        } else if (cues.receding && !cues.approaching) {
            distanceStart = 0.08;
            distanceEnd = 0.94;
            if (!cues.leftToRight && !cues.rightToLeft) panEnd *= 1.16;
        } else if (cues.far && !cues.near) {
            distanceStart = 0.88;
            distanceEnd = 0.9;
        } else if (cues.near && !cues.far) {
            distanceStart = 0.06;
            distanceEnd = 0.08;
        }

        const start = distanceValues(distanceStart, settings);
        const end = distanceValues(distanceEnd, settings);
        return normalizePlan({
            panStart,
            panEnd,
            gainStart: start.gain,
            gainEnd: end.gain,
            cutoffStart: start.cutoff,
            cutoffEnd: end.cutoff,
            roomStart: start.room,
            roomEnd: end.room
        });
    }

    /**
     * 为一条对白生成动态空间计划。
     * 对白正文可能只是在谈论“左边/远处”，因此仅解析明确的控制指令。
     */
    function createDialoguePlan({ line, eventIndex, rolePositions, profile }) {
        if (profile === 'standard') return { ...NEUTRAL_PLAN };
        const role = String(line && line.role || '').trim();
        const narrator = isNarrator(role);
        const anchor = narrator ? 0 : Number(rolePositions && rolePositions[role]) || 0;
        const instruction = [line && line.spatial_instruction, line && line.control_instruction]
            .filter(Boolean)
            .join('，');
        return createMotionPlan({
            anchor,
            identity: `dialogue:${role || 'unknown'}`,
            eventIndex,
            cues: parseSpatialCues(instruction),
            profile,
            narrator
        });
    }

    /** 为一项 SoundEffect 计划生成比对白更分散的动态空间计划。 */
    function createSoundEffectPlan({ plan, eventIndex, profile }) {
        if (profile === 'standard') return { ...NEUTRAL_PLAN };
        const prompt = [plan && plan.prompt, plan && plan.prompt_en].filter(Boolean).join('，');
        const cues = parseSpatialCues(prompt);
        const hash = stableUnitHash(`${prompt}:${plan && plan.id || ''}`);
        const magnitude = 0.3 + hash * (profile === 'immersive' ? 0.48 : 0.3);
        const anchor = (Math.floor(hash * 1000) % 2 === 0 ? -1 : 1) * magnitude;
        return createMotionPlan({
            anchor,
            identity: `sfx:${prompt}`,
            eventIndex,
            cues,
            profile,
            narrator: false
        });
    }

    /** 在一个 AudioParam 上安排起止连续变化。 */
    function scheduleLinear(parameter, startValue, endValue, startTime, endTime) {
        parameter.setValueAtTime(startValue, startTime);
        parameter.linearRampToValueAtTime(endValue, endTime);
    }

    /** 在频率参数上使用指数插值，听感比线性扫频更自然。 */
    function scheduleFrequency(parameter, startValue, endValue, startTime, endTime) {
        parameter.setValueAtTime(Math.max(1, startValue), startTime);
        parameter.exponentialRampToValueAtTime(Math.max(1, endValue), endTime);
    }

    /** 把节点接到声像节点；旧浏览器不支持 StereoPannerNode 时安全回退为直连。 */
    function connectWithPan(context, input, destination, startPan, endPan, startTime, endTime) {
        if (typeof context.createStereoPanner !== 'function') {
            input.connect(destination);
            return null;
        }
        const panner = context.createStereoPanner();
        scheduleLinear(panner.pan, startPan, endPan, startTime, endTime);
        input.connect(panner).connect(destination);
        return panner;
    }

    /**
     * 把现有增益节点接入对象级空间链路。
     * @param {Object} options - Web Audio 节点、调度区间与空间计划
     * @returns {Object} 创建的节点引用，主要用于浏览器回归诊断
     */
    function connectSpatialNodeChain({ context, input, destination, plan, startTime, duration, profile }) {
        if (profile === 'standard') {
            input.connect(destination);
            return { bypassed: true };
        }
        const safePlan = normalizePlan(plan || NEUTRAL_PLAN);
        const safeStart = Math.max(0, Number(startTime) || 0);
        const safeEnd = safeStart + Math.max(0.02, Number(duration) || 0.02);

        const distanceGain = context.createGain();
        scheduleLinear(distanceGain.gain, safePlan.gainStart, safePlan.gainEnd, safeStart, safeEnd);
        const distanceFilter = context.createBiquadFilter();
        distanceFilter.type = 'lowpass';
        distanceFilter.Q.value = 0.55;
        scheduleFrequency(
            distanceFilter.frequency,
            safePlan.cutoffStart,
            safePlan.cutoffEnd,
            safeStart,
            safeEnd
        );
        input.connect(distanceGain).connect(distanceFilter);
        const directPanner = connectWithPan(
            context,
            distanceFilter,
            destination,
            safePlan.panStart,
            safePlan.panEnd,
            safeStart,
            safeEnd
        );

        const reflectionNodes = [];
        const settings = getSettings(profile);
        [
            { delay: settings.reflectionDelay, scale: 0.72, panScale: -0.48 },
            { delay: settings.reflectionDelay * 2.15, scale: 0.38, panScale: -0.78 }
        ].forEach((tap) => {
            const delay = context.createDelay(0.2);
            delay.delayTime.value = tap.delay;
            const wetGain = context.createGain();
            scheduleLinear(
                wetGain.gain,
                safePlan.roomStart * tap.scale,
                safePlan.roomEnd * tap.scale,
                safeStart,
                safeEnd
            );
            distanceFilter.connect(delay).connect(wetGain);
            const wetPanner = connectWithPan(
                context,
                wetGain,
                destination,
                safePlan.panStart * tap.panScale,
                safePlan.panEnd * tap.panScale,
                safeStart,
                safeEnd
            );
            reflectionNodes.push({ delay, wetGain, wetPanner });
        });

        return { distanceGain, distanceFilter, directPanner, reflectionNodes, bypassed: false };
    }

    global.UnitaleSpatialTimeline = {
        createRolePositions,
        createDialoguePlan,
        createSoundEffectPlan,
        connectSpatialNodeChain
    };
}(window));

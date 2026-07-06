<script setup lang="ts">
/**
 * @fileoverview 脚本台词列表容器
 * @description 负责台词列表渲染、行组件分发、舞台背景样式和列表 DOM 引用
 * @module src/components/workbench/script/ScriptLineList
 */
import { computed } from 'vue'
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'
import BgmLineBlock from './BgmLineBlock.vue'
import BgImageLineBlock from './BgImageLineBlock.vue'
import DialogueLineBlock from './DialogueLineBlock.vue'

const {
  scriptLines,
  stageBgUrl,
  scriptListContainer,
  lineRefs,
  toggleLineSelection,
  rawAnalysisResult
} = useWorkbenchContext()

const scriptStageStyle = computed(() =>
  stageBgUrl.value
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.76), rgba(255,255,255,0.58)), url(${stageBgUrl.value})`,
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundPosition: 'center center, center center',
        backgroundSize: '100% 100%, contain'
      }
    : {}
)

const hasScriptLines = computed(() => scriptLines.value.length > 0)

const registerLineRef = (element: any, index: string | number): void => {
  if (element) {
    lineRefs.value[Number(index)] = element
  }
}

const registerScriptListContainer = (element: any): void => {
  scriptListContainer.value = element
}
</script>

<template>
  <div>
    <el-card v-if="hasScriptLines" shadow="never" :style="scriptStageStyle">
      <template #header>
        <div class="font-bold text-slate-700">2. 脚本台词列表 ({{ scriptLines.length }} 行)</div>
      </template>
      <div class="space-y-3 max-h-[600px] overflow-y-auto px-2 pb-10" :ref="registerScriptListContainer">
        <div
          v-for="(line, index) in scriptLines"
          :key="line.id"
          class="transition-all duration-200"
          @click="toggleLineSelection(Number(index), $event)"
          :ref="(el) => registerLineRef(el, index)"
        >
          <BgmLineBlock v-if="line.type === 'bgm'" :line="line" :index="Number(index)" />
          <BgImageLineBlock v-else-if="line.type === 'bgImage'" :line="line" :index="Number(index)" />
          <DialogueLineBlock v-else :line="line" :index="Number(index)" />
        </div>
      </div>
    </el-card>

    <el-card v-if="rawAnalysisResult" shadow="never" class="mt-6">
      <template #header>
        <div class="font-bold text-slate-700">3. AI 原始输出 (调试用)</div>
      </template>
      <pre class="bg-slate-800 text-slate-200 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-64">{{ rawAnalysisResult }}</pre>
    </el-card>
  </div>
</template>

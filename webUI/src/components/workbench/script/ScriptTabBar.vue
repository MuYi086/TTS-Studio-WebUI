<script setup lang="ts">
/**
 * @fileoverview 脚本页签栏
 * @description 使用 Element Plus Tabs 负责多脚本切换、重命名、新增与删除入口
 * @module src/components/workbench/script/ScriptTabBar
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'
import type { ComponentPublicInstance } from 'vue'
import type { FocusableInput } from '../../../types/workbench'

const {
  scriptList,
  currentScriptId,
  editingScriptId,
  switchScript,
  startEditingScript,
  stopEditingScript,
  scriptNameInputRefs,
  deleteScriptTab,
  addScript
} = useWorkbenchContext()

const isFocusableInput = (element: unknown): element is FocusableInput =>
  Boolean(element && typeof (element as FocusableInput).focus === 'function')

const registerScriptNameInput = (
  element: Element | ComponentPublicInstance | null,
  scriptId: string
): void => {
  if (isFocusableInput(element)) {
    scriptNameInputRefs.value[scriptId] = element
  }
}
</script>

<template>
  <div class="flex items-start gap-3 mb-6">
    <el-tabs
      :model-value="currentScriptId"
      type="card"
      class="flex-1 min-w-0 script-tabs"
      @tab-change="switchScript"
      @tab-remove="deleteScriptTab"
    >
      <el-tab-pane v-for="script in scriptList" :key="script.id" :name="script.id" closable>
        <template #label>
          <span v-if="editingScriptId !== script.id" class="inline-flex items-center" @dblclick.stop="startEditingScript(script.id)">
            {{ script.name }}
          </span>
          <el-input
            v-else
            v-model="script.name"
            size="small"
            class="w-[120px]"
            @click.stop
            @blur="stopEditingScript"
            @keyup.enter="stopEditingScript"
            :ref="(el) => registerScriptNameInput(el, script.id)"
          />
        </template>
      </el-tab-pane>
    </el-tabs>
    <el-button type="primary" plain @click="addScript">
      <el-icon><Plus /></el-icon>
      <span>新增脚本</span>
    </el-button>
  </div>
</template>

<style scoped>
.script-tabs {
  --el-tabs-header-height: 36px;
}
</style>

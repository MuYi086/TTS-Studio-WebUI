<script setup lang="ts">
/**
 * @fileoverview 脚本页签栏
 * @description 负责多脚本切换、重命名、新增与删除入口
 * @module src/components/workbench/script/ScriptTabBar
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'

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

const registerScriptNameInput = (element: any, scriptId: string): void => {
  if (element) {
    scriptNameInputRefs.value[scriptId] = element
  }
}
</script>

<template>
  <div class="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
    <div
      v-for="script in scriptList"
      :key="script.id"
      :class="['flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-bold transition-colors min-w-[100px] flex-shrink-0 justify-between group', currentScriptId === script.id ? 'bg-white border border-slate-200 text-blue-600' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200']"
      @click="switchScript(script.id)"
      @dblclick="startEditingScript(script.id)"
    >
      <span v-if="editingScriptId !== script.id" class="whitespace-nowrap">{{ script.name }}</span>
      <input
        v-else
        v-model="script.name"
        class="bg-transparent outline-none w-full"
        @click.stop
        @blur="stopEditingScript"
        @keyup.enter="stopEditingScript"
        :ref="(el) => registerScriptNameInput(el, script.id)"
      />
      <button class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" @click.stop="deleteScriptTab(script.id)">x</button>
    </div>
    <button class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs" @click="addScript">+</button>
  </div>
</template>

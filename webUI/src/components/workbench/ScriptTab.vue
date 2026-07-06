<script setup lang="ts">
/**
 * @fileoverview 脚本制作工作台标签页
 * @description 组合脚本页签、角色侧栏、输入控制面板和台词列表
 * @module src/components/workbench/ScriptTab
 */
import ScriptTabBar from './script/ScriptTabBar.vue'
import CharacterSidebar from './script/CharacterSidebar.vue'
import ScriptInputPanel from './script/ScriptInputPanel.vue'
import ScriptLineList from './script/ScriptLineList.vue'
</script>

<template>
  <div>
    <ScriptTabBar />

    <div class="flex flex-col lg:flex-row gap-6 items-start">
      <CharacterSidebar />

      <div class="flex-1 w-full space-y-6 min-w-0">
        <ScriptInputPanel />
        <ScriptLineList />
      </div>
    </div>
  </div>
</template>

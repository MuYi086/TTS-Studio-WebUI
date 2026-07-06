<script setup lang="ts">
/**
 * @fileoverview 音频资源标签页入口
 * @description 组合音效、BGM 与滤波器三个高内聚资源区块
 * @module src/components/workbench/SfxTab
 */
import AudioAssetSection from './sfx/AudioAssetSection.vue'
import FilterSection from './sfx/FilterSection.vue'
</script>

<template>
  <div class="space-y-8">
    <AudioAssetSection kind="sfx" />
    <AudioAssetSection kind="bgm" />
    <FilterSection />
  </div>
</template>

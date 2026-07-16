<script setup lang="ts">
import AudioLibraryPanel from './library/AudioLibraryPanel.vue';
import FilterLibraryPanel from './library/FilterLibraryPanel.vue';
</script>

<template>
  <section class="stack">
    <AudioLibraryPanel
      kind="sfx"
      eyebrow="SFX 资源库"
      title="音效素材"
      description="真实波形、试听进度、默认音量与裁剪区间会共同作用于脚本播放和导出。"
    />
    <AudioLibraryPanel
      kind="bgm"
      eyebrow="BGM 资源库"
      title="背景音乐素材"
      description="支持本地试听与可视化裁剪，并沿用 filename、assetKey、trimStart、trimEnd 和 volume。"
    />
    <FilterLibraryPanel />
  </section>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 18px;
}
</style>

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
      description="先迁移文件元数据、默认音量和裁剪比例，波形试听后续再接。"
    />
    <AudioLibraryPanel
      kind="bgm"
      eyebrow="BGM 资源库"
      title="背景音乐素材"
      description="沿用旧结构中的 filename、assetKey、trimStart、trimEnd 和 volume。"
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

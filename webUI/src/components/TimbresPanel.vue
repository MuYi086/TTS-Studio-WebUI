<script setup lang="ts">
import EmotionPresetPanel from './library/EmotionPresetPanel.vue';
import TimbreLibraryPanel from './library/TimbreLibraryPanel.vue';
</script>

<template>
  <section class="stack">
    <TimbreLibraryPanel />
    <EmotionPresetPanel />
  </section>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 18px;
}
</style>

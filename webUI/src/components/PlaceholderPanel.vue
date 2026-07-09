<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  stage: string;
  bullets: string[];
}>();
</script>

<template>
  <article class="card">
    <p class="eyebrow">{{ stage }}</p>
    <h3>{{ title }}</h3>
    <p class="description">{{ description }}</p>
    <ul class="list">
      <li v-for="item in bullets" :key="item">{{ item }}</li>
    </ul>
  </article>
</template>

<style scoped>
.card {
  padding: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.03), transparent 48%),
    rgba(255, 255, 255, 0.94);
}

.eyebrow {
  margin: 0 0 8px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h3 {
  margin: 0 0 10px;
  font-size: 1.35rem;
}

.description {
  margin: 0 0 16px;
  color: #64748b;
}

.list {
  margin: 0;
  padding-left: 18px;
  color: #334155;
}

.list li + li {
  margin-top: 10px;
}
</style>

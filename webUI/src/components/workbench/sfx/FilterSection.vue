<script setup lang="ts">
/**
 * @fileoverview 音频滤波器资源区块
 * @description 维护对白可选滤波器的表单、参数和资源列表
 * @module src/components/workbench/sfx/FilterSection
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'

const {
  isEditingFilter,
  filterForm,
  saveFilter,
  resetFilterForm,
  filterLibrary,
  editFilter,
  deleteFilter
} = useWorkbenchContext()
</script>

<template>
  <section class="space-y-6 border-t border-slate-200 pt-6">
    <h2 class="text-lg font-bold text-slate-800 border-b pb-2">音频滤波器管理</h2>

    <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
      <h3 class="text-sm font-bold text-slate-700 mb-4">{{ isEditingFilter ? '编辑滤波器' : '添加新滤波器' }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">滤波器名称</label>
          <input
            v-model="filterForm.name"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="例如: 电话音 / 水下"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">滤波器描述 (用于 AI 判断)</label>
          <input
            v-model="filterForm.description"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="例如: 声音通过电话传输，频段变窄"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">滤波器类型</label>
          <select v-model="filterForm.type" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="lowpass">低通 (Lowpass) - 适合水下/闷声</option>
            <option value="highpass">高通 (Highpass) - 适合收音机/尖锐</option>
            <option value="bandpass">带通 (Bandpass) - 适合电话/对讲机</option>
            <option value="distortion">失真 (Distortion) - 适合机器人/损坏设备</option>
          </select>
        </div>
        <div v-if="filterForm.type !== 'distortion'">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">频率 (Hz): {{ filterForm.frequency }}</label>
          <input
            v-model.number="filterForm.frequency"
            type="range"
            min="20"
            max="20000"
            step="10"
            class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
        <div v-if="filterForm.type !== 'distortion'">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Q 值 (共振峰): {{ filterForm.Q }}</label>
          <input
            v-model.number="filterForm.Q"
            type="range"
            min="0.1"
            max="20"
            step="0.1"
            class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
        <div v-if="filterForm.type === 'distortion'">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">失真度 (Amount): {{ filterForm.gain }}</label>
          <input
            v-model.number="filterForm.gain"
            type="range"
            min="0"
            max="1000"
            step="10"
            class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
          @click.prevent="saveFilter"
        >
          保存滤波器
        </button>
        <button
          v-if="isEditingFilter"
          type="button"
          class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
          @click="resetFilterForm"
        >
          取消
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="filter in filterLibrary"
        :key="filter.id"
        class="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow flex justify-between items-center"
      >
        <div class="flex items-center gap-3">
          <input
            v-model="filter.enabled"
            type="checkbox"
            class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            title="启用/禁用此资源"
          />
          <div>
            <div class="font-bold text-slate-800 text-sm">{{ filter.name }}</div>
            <div class="text-xs text-slate-500 mt-0.5">{{ filter.description }}</div>
            <div class="text-[10px] text-slate-400 mt-1 font-mono">
              {{ filter.type }} | {{ filter.type === 'distortion' ? `Amt:${filter.gain}` : `Freq:${filter.frequency}Hz` }}
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="text-xs text-blue-600 hover:underline font-medium" @click="editFilter(filter)">编辑</button>
          <button class="text-xs text-red-500 hover:underline font-medium" @click="deleteFilter(filter.id)">删除</button>
        </div>
      </div>
      <div v-if="filterLibrary.length === 0" class="col-span-full text-center py-8 text-slate-400 text-sm">暂无滤波器，请添加</div>
    </div>
  </section>
</template>

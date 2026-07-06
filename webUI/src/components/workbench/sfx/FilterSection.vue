<script setup lang="ts">
/**
 * @fileoverview 音频滤波器资源区块
 * @description 使用 Element Plus 维护对白可选滤波器的表单、参数和资源列表
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

    <el-card shadow="never">
      <template #header>
        <div class="font-bold text-slate-700">{{ isEditingFilter ? '编辑滤波器' : '添加新滤波器' }}</div>
      </template>

      <el-form :model="filterForm" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="滤波器名称">
              <el-input v-model="filterForm.name" clearable placeholder="例如: 电话音 / 水下" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="滤波器描述 (用于 AI 判断)">
              <el-input v-model="filterForm.description" clearable placeholder="例如: 声音通过电话传输，频段变窄" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="滤波器类型">
              <el-select v-model="filterForm.type" class="w-full">
                <el-option label="低通 (Lowpass) - 适合水下/闷声" value="lowpass" />
                <el-option label="高通 (Highpass) - 适合收音机/尖锐" value="highpass" />
                <el-option label="带通 (Bandpass) - 适合电话/对讲机" value="bandpass" />
                <el-option label="失真 (Distortion) - 适合机器人/损坏设备" value="distortion" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="filterForm.type !== 'distortion'" :xs="24" :md="12">
            <el-form-item :label="`频率 (Hz): ${filterForm.frequency}`">
              <el-slider v-model="filterForm.frequency" :min="20" :max="20000" :step="10" />
            </el-form-item>
          </el-col>
          <el-col v-if="filterForm.type !== 'distortion'" :xs="24" :md="12">
            <el-form-item :label="`Q 值 (共振峰): ${filterForm.Q}`">
              <el-slider v-model="filterForm.Q" :min="0.1" :max="20" :step="0.1" />
            </el-form-item>
          </el-col>
          <el-col v-if="filterForm.type === 'distortion'" :xs="24" :md="12">
            <el-form-item :label="`失真度 (Amount): ${filterForm.gain}`">
              <el-slider v-model="filterForm.gain" :min="0" :max="1000" :step="10" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-space>
          <el-button type="primary" @click.prevent="saveFilter">
            <el-icon><Check /></el-icon>
            <span>保存滤波器</span>
          </el-button>
          <el-button v-if="isEditingFilter" @click="resetFilterForm">
            <el-icon><Close /></el-icon>
            <span>取消</span>
          </el-button>
        </el-space>
      </el-form>
    </el-card>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <el-card v-for="filter in filterLibrary" :key="filter.id" shadow="hover">
        <div class="flex justify-between items-center gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <el-checkbox v-model="filter.enabled" title="启用/禁用此资源" />
            <div class="min-w-0">
              <div class="font-bold text-slate-800 text-sm">{{ filter.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ filter.description }}</div>
              <el-tag size="small" type="info" effect="plain" class="mt-1">
                {{ filter.type }} | {{ filter.type === 'distortion' ? `Amt:${filter.gain}` : `Freq:${filter.frequency}Hz` }}
              </el-tag>
            </div>
          </div>
          <el-space>
            <el-button type="primary" link @click="editFilter(filter)">编辑</el-button>
            <el-button type="danger" link @click="deleteFilter(filter.id)">删除</el-button>
          </el-space>
        </div>
      </el-card>
      <el-empty v-if="filterLibrary.length === 0" class="col-span-full" description="暂无滤波器，请添加" />
    </div>
  </section>
</template>

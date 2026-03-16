<template>
  <main class="main-content" style="flex: 1; position: relative;">
    <div v-if="isLoading" class="loading" style="padding: 20px;">正在載入圖紙資料...</div>
    
    <div v-else-if="!selectedDrawing" style="padding: 20px;">目前沒有圖紙，請點擊上方新增圖紙。</div>
    
    <div 
      v-else 
      class="svg-viewport" 
      @wheel.prevent="$emit('wheel', $event)" 
      @mousedown="$emit('mousedown', $event)"
    >
      <button class="icon-btn reset-zoom-btn" @click="$emit('reset-zoom')" title="重設視角">🏠 重設</button>
      
      <div class="svg-wrapper" :style="panZoomStyle" @click="$emit('svg-click', $event)">
        <div v-html="rawSvg"></div>
        
        <AnnotationLayer
          :annotations="annotations"
          :scale="scale"
          :isAnnoInputOpen="isAnnoInputOpen"
          :draftAnno="draftAnno"
          @updateDraftText="$emit('update:draftText', $event)"
          @updateDraftColor="$emit('update:draftColor', $event)"        
          @updateDraftFontSize="$emit('update:draftFontSize', $event)"
          @updateDraftType="$emit('update:draftType', $event)"  
          @closeModal="$emit('close-modal')"
          @confirmAdd="$emit('confirm-add', $event)"
          @startDrag="(e, anno, type) => $emit('start-drag', e, anno, type)"
          @delete="$emit('delete-annotation', $event)"
          @edit="$emit('edit-annotation', $event)"
        />
      </div>
    </div>
  </main>
</template>

<script setup>
// 引入標註層組件 (因為它現在包在畫布裡面了)
import AnnotationLayer from './AnnotationLayer.vue'

// 接收來自 App.vue 的資料
defineProps({
  isLoading: Boolean,
  selectedDrawing: String,
  panZoomStyle: Object,
  rawSvg: String,
  annotations: Array,
  scale: Number,
  isAnnoInputOpen: Boolean,
  draftAnno: Object
})

// 定義要傳回給 App.vue 的事件 (滑鼠拖曳、點擊、標註動作等)
defineEmits([
  'wheel', 'mousedown', 'reset-zoom', 'svg-click',
  'update:draftText', 
  'update:draftColor', 
  'update:draftFontSize', 
  'update:draftType',   // ✨ 就是要加這一行在這裡！
  'close-modal', 'confirm-add', 'start-drag', 'delete-annotation', 'edit-annotation'
])
</script>

<style scoped>
/* 主畫面容器樣式 */
.main-content { flex: 1; overflow: hidden; background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); position: relative; }
.svg-viewport { width: 100%; height: 100%; overflow: hidden; position: relative; cursor: grab; background-color: #fdfdfd; }
.svg-viewport:active { cursor: grabbing; }

/* 用來被放大縮小的內部容器 */
.svg-wrapper { display: inline-block; position: relative; }

/* 重設視角按鈕 */
.reset-zoom-btn { position: absolute; top: 15px; right: 15px; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-weight: bold; background: white; border: 1px solid #ddd; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
.reset-zoom-btn:hover { background: #f0f0f0; }

/* SVG 內部 TAG 樣式 */
:deep(.svg-wrapper text), :deep(.svg-wrapper tspan) { 
  transition: fill 0.2s; 
  cursor: text; /* 滑鼠移過去會變成文字輸入棒的形狀 */
  user-select: text; /* 強制開啟瀏覽器的反白選取功能 */
}
:deep(.svg-wrapper .has-data-tag) { fill: #2980b9 !important; font-weight: bold !important; text-decoration: underline; cursor: pointer; }
:deep(.svg-wrapper .has-data-tag:hover) { fill: #e74c3c !important; }

/* 搜尋高亮特效 */
@keyframes pulse-highlight {
  0% { fill: #e74c3c; stroke: #e74c3c; stroke-width: 0px; }
  50% { fill: #f1c40f; stroke: #e74c3c; stroke-width: 2px; }
  100% { fill: #e74c3c; stroke: #e74c3c; stroke-width: 0px; }
}
:deep(.search-highlight) { fill: #e74c3c !important; font-weight: bold !important; animation: pulse-highlight 0.8s infinite; }

/* 虛擬畫布固定尺寸 */
:deep(.svg-wrapper svg) { width: 1800px !important; height: 1000px !important; display: block !important; max-width: none !important; }
</style>
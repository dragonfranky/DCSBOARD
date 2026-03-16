<template>
  <aside class="sidebar-menu">
    <div class="sidebar-header">
      <h3>📂 系統圖紙目錄</h3>
    </div>
    <div class="sidebar-content">
      <details v-for="(drawings, category) in groupedDrawings" :key="category" open class="category-group">
        <summary class="category-title">
          📁 {{ category }} <span class="badge">{{ drawings.length }}</span>
        </summary>
        <ul class="drawing-list">
          <li 
            v-for="dwg in drawings" 
            :key="dwg.value" 
            :class="{ 'active': selectedDrawing === dwg.value && currentStation === category }"
            @click="$emit('select-drawing', { station: category, drawing: dwg.value })"
          >
            📄 {{ dwg.label }}
          </li>
        </ul>
      </details>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  groupedDrawings: Object,
  selectedDrawing: String,
  currentStation: String // 接收站別
})

defineEmits(['select-drawing'])
</script>

<style scoped>
.sidebar-menu { width: 280px; min-width: 280px; background: #ffffff; border-right: 1px solid #ddd; display: flex; flex-direction: column; box-shadow: 2px 0 5px rgba(0,0,0,0.05); z-index: 10; }
.sidebar-header { padding: 15px 20px; background: #2c3e50; color: white; }
.sidebar-header h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.sidebar-content { flex: 1; overflow-y: auto; padding: 10px 0; }
.category-group { margin-bottom: 5px; }
.category-title { padding: 10px 20px; font-weight: bold; color: #34495e; cursor: pointer; user-select: none; display: flex; align-items: center; transition: background 0.2s; }
.category-title:hover { background: #f1f4f8; }
.category-title::-webkit-details-marker { display: none; }
.badge { margin-left: auto; background: #ecf0f1; color: #7f8c8d; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
.drawing-list { list-style: none; padding: 0; margin: 0; background: #f9fbfc; }
.drawing-list li { padding: 10px 20px 10px 40px; cursor: pointer; color: #555; font-size: 14px; border-left: 3px solid transparent; transition: all 0.2s; }
.drawing-list li:hover { background: #edf2f7; color: #2980b9; }
.drawing-list li.active { background: #e1f0fa; color: #2980b9; font-weight: bold; border-left: 3px solid #3498db; }
@media print { .sidebar-menu { display: none !important; } }
</style>
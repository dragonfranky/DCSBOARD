<template>
  <header class="nav-bar">
    <label><strong>選擇圖紙：</strong></label>
    
    <select :value="selectedDrawing" @change="onDrawingChange" class="drawing-select">
      <optgroup v-for="(drawings, category) in groupedDrawings" :key="category" :label="'『 ' + category + ' 』'">
        <option v-for="dwg in drawings" :key="dwg.value" :value="dwg.value">
          {{ dwg.label }}
        </option>
      </optgroup>
    </select>
    
    <button v-if="selectedDrawing" @click="$emit('edit-drawing')" class="icon-btn" title="修改圖紙名稱">✏️</button>
    <button v-if="selectedDrawing" @click="$emit('delete-drawing')" class="icon-btn delete-icon" title="刪除圖紙">🗑️</button>
    
    <button v-if="selectedDrawing" @click="handlePrint" class="icon-btn print-btn" title="列印目前圖面 (可存為 PDF)" style="margin-left: 10px;">
      🖨️ 列印 PDF
    </button>

    <button class="icon-btn" :class="{ 'active-mode': isAnnotationMode }" @click="$emit('toggle-annotation')" title="在圖紙上點擊以新增標註" style="margin-left: 15px;">
      💬 {{ isAnnotationMode ? '取消標註' : '新增對話框' }}
    </button>

    <div style="margin-left: auto; display: flex; align-items: center; gap: 5px;">
      <input 
        :value="searchQuery" 
        @input="$emit('update:searchQuery', $event.target.value)"
        @keyup.enter="$emit('search')"
        type="text" 
        placeholder="搜尋設備 (如 PT-001)" 
        style="padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; width: 160px; font-size: 14px;"
      >
      <button @click="$emit('search')" class="icon-btn" title="搜尋設備">🔍</button>
    </div>

    <button @click="$emit('add-drawing')" class="add-main-btn" style="margin-left: 10px;">➕ 新增圖紙</button>
  </header>
</template>

<script setup>
// 接收 App.vue 傳遞過來的資料與狀態
defineProps({
  groupedDrawings: Object,
  selectedDrawing: String,
  isAnnotationMode: Boolean,
  searchQuery: String
})

// 定義要通知 App.vue 執行的動作
const emit = defineEmits([
  'update:selectedDrawing',
  'update:searchQuery',
  'load-system-data',
  'edit-drawing',
  'delete-drawing',
  'toggle-annotation',
  'search',
  'add-drawing',
  'print-main' // ✨ 新增這行
])

// ✨ 修改列印函數，改為通知主系統
const handlePrint = () => {
  emit('print-main');
};

// 處理下拉選單切換
const onDrawingChange = (e) => {
  emit('update:selectedDrawing', e.target.value);
  emit('load-system-data');
}
</script>

<style scoped>
/* 頂部導覽列 CSS */
.nav-bar { background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; align-items: center; }
.drawing-select { padding: 5px; font-size: 16px; margin-left: 10px; }
.add-main-btn { margin-left: auto; background: #2ecc71; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.add-main-btn:hover { background: #27ae60; }
.icon-btn { background: none; border: 1px solid #ddd; padding: 5px 10px; margin-left: 5px; border-radius: 4px; cursor: pointer; font-size: 14px; background: white; }
.icon-btn:hover { background: #f0f0f0; }
.delete-icon:hover { background: #fee; border-color: #e74c3c; color: #c0392b; }
.active-mode { background-color: #f39c12 !important; color: white !important; border-color: #e67e22 !important; font-weight: bold; }

/* 列印時隱藏上方工具列 */
@media print {
  .nav-bar { display: none !important; }
}
</style>
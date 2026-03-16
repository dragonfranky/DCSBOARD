<template>
  <div class="app-container" style="display: flex; height: 100vh; overflow: hidden; background: #f0f2f5;">
    
    <SidebarMenu 
      :groupedDrawings="groupedDrawings" 
      :selectedDrawing="selectedDrawing"
      :currentStation="currentStation"
      @select-drawing="selectDrawingFromSidebar"
    />

    <div class="main-workspace" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
      
      <TopNavBar 
        :groupedDrawings="groupedDrawings"
        :selectedDrawing="selectedDrawing"
        :isAnnotationMode="isAnnotationMode"
        :searchQuery="searchQuery"
        @update:selectedDrawing="selectedDrawing = $event"
        @update:searchQuery="searchQuery = $event"
        @load-system-data="loadSystemData"
        @edit-drawing="editCurrentDrawing"
        @delete-drawing="deleteCurrentDrawing"
      
        @toggle-annotation="isAnnotationMode = !isAnnotationMode"
        @search="handleSearch"
        @add-drawing="isAddMainModalOpen = true"
        @print-main="handlePrintMain"
      />

      <MainCanvas 
        :isLoading="isLoading"
        :selectedDrawing="selectedDrawing"
        :panZoomStyle="panZoomStyle"
        :rawSvg="rawSvg"
        :annotations="annotations"
        :scale="scale"
        :isAnnoInputOpen="isAnnoInputOpen"
        :draftAnno="draftAnno"
        @wheel="handleWheel"
        @mousedown="startPan"
        @reset-zoom="resetZoom"
        @svg-click="handleSvgClick"
        @update:draftText="draftAnno.text = $event"
        @update:draftColor="draftAnno.color = $event"
        @update:draftFontSize="draftAnno.fontSize = $event"
        @update:draftType="draftAnno.type = $event"
        @close-modal="isAnnoInputOpen = false"
        @confirm-add="confirmAddAnno"
        @start-drag="startDragAnno"
        @delete-annotation="deleteAnnotation"
        @edit-annotation="editAnnotation"
      />

    </div> <AddDrawingModal 
      :isOpen="isAddMainModalOpen" 
      :newDrawing="newDrawing" 
      @close="isAddMainModalOpen = false" 
      @fileChange="onNewMainFileChange" 
      @submit="submitNewDrawing" 
    />

    <DetailModal 
      v-for="modal in openModals"
      :key="modal.id"
      :isOpen="true"
      :blockId="modal.blockId"
      :blockData="modal.blockData"
      :selectedDrawing="modal.drawingId"  :zIndex="modal.zIndex"
      :top="modal.top"
      :left="modal.left"
      @focus="bringToFront(modal.id)"
      @close="closeDetailModal(modal.id)"
      
      @saveText="(blockId, newData) => saveBlockText(modal.station, modal.drawingId, blockId, newData)"
      @uploadImage="(blockId, file) => handleFileUpload(modal.drawingId, blockId, file)"
      @deleteImage="(blockId) => deleteBlockImage(modal.drawingId, blockId)"
      @imageError="() => handleImageError(modal.id)" 
    />

    <SearchListModal
      :isOpen="isSearchListOpen"
      :isSearching="isSearching"
      :searchResults="searchResults"
      :searchQuery="searchQuery"
      @close="isSearchListOpen = false"
      @select-result="goToResult"
    />
  </div>
</template>

<script setup>
import { onMounted, nextTick } from 'vue'
import { useMainPanZoom } from './composables/usePanZoom'
import { useAnnotations } from './composables/useAnnotations'
import { useSystemData } from './composables/useSystemData'
import { usePrint } from './composables/usePrint' // ✨ 1. 匯入列印模組
import DetailModal from './components/DetailModal.vue'
import AddDrawingModal from './components/AddDrawingModal.vue'
import { useSearch } from './composables/useSearch'
import SearchListModal from './components/SearchListModal.vue'
import SidebarMenu from './components/SidebarMenu.vue'
import TopNavBar from './components/TopNavBar.vue'
import MainCanvas from './components/MainCanvas.vue'

// ✨ 側邊欄點擊切換圖紙
const selectDrawingFromSidebar = (selection) => {
  // 防呆機制：確保接收到的是一個包含站別與圖號的物件
  if (selection && selection.station && selection.drawing) {
    currentStation.value = selection.station;
    selectedDrawing.value = selection.drawing;
    loadSystemData();
  } else {
    console.error("側邊欄傳遞資料錯誤：", selection);
  }
};

// ==========================================
// 1. 初始化：主畫面與彈出視窗的拖曳縮放邏輯
// ==========================================
const { scale, translateX, translateY, hasDragged, panZoomStyle, resetZoom, handleWheel, startPan } = useMainPanZoom();

// ==========================================
// ✨ 初始化：列印模組
// ==========================================
const { printMain } = usePrint();
const handlePrintMain = () => {
  printMain(resetZoom); // 把重設視角的方法傳進去給模組執行
};

// ==========================================
// 2. 初始化：系統資料與 API 邏輯
// ==========================================
const {
  drawingOptions, groupedDrawings, selectedDrawing, currentStation, rawSvg, currentBlockData, isLoading, annotations,
  isAddMainModalOpen, newDrawing, 
  openModals, openDetailModal, closeDetailModal, bringToFront, // ✨ 改成這 4 個控制器
  fetchAvailableDrawings, applyTagHighlights, loadSystemData, editCurrentDrawing,
  deleteCurrentDrawing, onNewMainFileChange, submitNewDrawing,
  saveBlockText, handleFileUpload, deleteBlockImage, handleImageError
} = useSystemData(resetZoom);

// ==========================================
// 3. 初始化：標註系統邏輯 (主圖紙)
// ==========================================
const saveMainAnnotations = async (newAnnos) => {
  // ✨ 巧妙利用既有的 custom_data API，將主圖紙當作名為 'MAIN_CANVAS' 的設備來儲存標註
  await fetch(`/api/custom_data/${currentStation.value}/${selectedDrawing.value}/MAIN_CANVAS`, {
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: '主圖紙標註', logic: '', annotations: newAnnos })
  });
};

const {
  isAnnotationMode, isAnnoInputOpen, draftAnno,
  confirmAddAnno, deleteAnnotation, startDragAnno, editAnnotation
} = useAnnotations(annotations, scale, translateX, translateY, saveMainAnnotations);

// ==========================================
// 3.5 準備給搜尋功能呼叫的函數 (用來一鍵開啟詳細圖面視窗)
// ==========================================
const openDetailModalFromSearch = (blockId, blockData) => {
  activeBlockId.value = blockId;
  activeBlockData.value = {
    type: blockData?.type || '',     
    logic: blockData?.logic || '',   
    svgFile: blockData?.svgFile || null, 
    customImageUrl: blockData?.customImageUrl || null
  }
  isModalOpen.value = true;
};

// ==========================================
// 4. 初始化：搜尋功能邏輯
// ==========================================
const { 
  searchQuery, searchResults, isSearchListOpen, isSearching, 
  handleSearch, goToResult 
} = useSearch(
  scale, translateX, translateY, 
  drawingOptions, selectedDrawing, currentStation, loadSystemData, openDetailModal 
);

// ==========================================
// 處理主圖紙的點擊事件 (包含新增標註與開啟 Tag)
// ==========================================
const handleSvgClick = async (e) => {
  if (hasDragged.value) return; 

  if (isAnnotationMode.value) {
    const viewport = document.querySelector('.svg-viewport');
    const rect = viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left - translateX.value) / scale.value;
    const y = (e.clientY - rect.top - translateY.value) / scale.value;

    draftAnno.value = { targetX: x, targetY: y, x: x + 100, y: y - 80, text: '', id: null, color: '#e74c3c', fontSize: 14, type: 'bubble' };
    isAnnoInputOpen.value = true;
    isAnnotationMode.value = false; 
    return; 
  }

  const target = e.target
  if (target.tagName === 'text' || target.tagName === 'tspan') {
    const textContent = target.textContent.trim()
    if (textContent.length < 2) return; 

    const existData = currentBlockData.value[textContent];

    if (existData || e.ctrlKey) {
      openDetailModal(textContent, existData); // ✨ 改用新函數
    }
  }
}

onMounted(async () => {
  await fetchAvailableDrawings();
  loadSystemData();
})
</script>

<style scoped>
.app-container { font-family: sans-serif; background: #f5f5f5; height: 100vh; box-sizing: border-box; display: flex; flex-direction: row; }
.icon-btn { background: none; border: 1px solid #ddd; padding: 5px 10px; margin-left: 5px; border-radius: 4px; cursor: pointer; font-size: 14px; background: white; }
.icon-btn:hover { background: #f0f0f0; }

</style>
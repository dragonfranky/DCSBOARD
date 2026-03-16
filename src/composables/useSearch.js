import { ref, nextTick } from 'vue'

export function useSearch(scale, translateX, translateY, drawingOptions, selectedDrawing, currentStation, loadSystemData, openDetailModal) {
  const searchQuery = ref('');
  const searchResults = ref([]);       
  const isSearchListOpen = ref(false); 
  const isSearching = ref(false);      

  const handleSearch = async () => {
    if (!searchQuery.value.trim()) return;
    const query = searchQuery.value.trim();

    searchResults.value = [];
    isSearching.value = true;
    isSearchListOpen.value = true; 

    try {
      // ✨ 呼叫後端極速 SQLite 搜尋 API (不再下載 SVG 了！)
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (res.ok) {
        const data = await res.json();
        
        // 幫結果補上圖紙的中文名稱，讓清單比較好看
        searchResults.value = data.map(item => {
          const dwgInfo = drawingOptions.value.find(d => d.value === item.drawingId && d.category === item.station);
          item.drawingLabel = dwgInfo ? dwgInfo.label : item.drawingId;
          return item;
        });
      }
    } catch (error) { 
      console.error("搜尋失敗:", error); 
    } finally {
      isSearching.value = false; // 搜尋瞬間結束
    }
  };

  const goToResult = async (result) => {
    isSearchListOpen.value = false; 

    // 1. 如果目標不在目前的站別或圖紙，先幫他切換過去！
    if (selectedDrawing.value !== result.drawingId || currentStation.value !== result.station) {
      currentStation.value = result.station;    
      selectedDrawing.value = result.drawingId; 
      await loadSystemData();
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 300)); 
    }

    // 2. 執行放大對焦與閃爍特效
    if (result.locationType === 'main') {
      const wrapper = document.querySelector('.svg-wrapper');
      if (!wrapper) return;
      const textNodes = wrapper.querySelectorAll('text, tspan');
      let targetNode = null;
      for (const node of textNodes) {
        if (node.textContent.trim() === result.matchText) { 
          targetNode = node; 
          break; 
        }
      }

      if (targetNode) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const targetRect = targetNode.getBoundingClientRect();
        const origX = (targetRect.left + targetRect.width / 2 - wrapperRect.left) / scale.value;
        const origY = (targetRect.top + targetRect.height / 2 - wrapperRect.top) / scale.value;

        scale.value = 3;
        const viewport = document.querySelector('.svg-viewport');
        translateX.value = viewport.clientWidth / 2 - origX * scale.value;
        translateY.value = viewport.clientHeight / 2 - origY * scale.value;

        targetNode.classList.add('search-highlight');
        setTimeout(() => { targetNode.classList.remove('search-highlight'); }, 3000); 
      }
    }
  };

  return { 
    searchQuery, searchResults, isSearchListOpen, isSearching, 
    handleSearch, goToResult 
  }
}
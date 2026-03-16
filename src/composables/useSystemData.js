import { ref, computed, nextTick, watch } from 'vue'

export function useSystemData(resetZoom) {
  const drawingOptions = ref([])
  const selectedDrawing = ref('')
  const currentStation = ref('') 
  
  const rawSvg = ref('')
  const currentBlockData = ref({})
  const isLoading = ref(false)
  const annotations = ref([])

  const isAddMainModalOpen = ref(false)
  const newDrawing = ref({ id: '', name: '', category: '', file: null })

  const groupedDrawings = computed(() => {
    const groups = {};
    drawingOptions.value.forEach(dwg => {
      const cat = dwg.category || '未分類';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(dwg);
    });
    return groups;
  });

  // ==========================================
  // 多視窗陣列與圖層管理器
  // ==========================================
  const openModals = ref([])
  let modalZIndexCounter = 1000

  const openDetailModal = async (blockId) => {
    const existing = openModals.value.find(m => m.blockId === blockId && m.drawingId === selectedDrawing.value);
    if (existing) {
      bringToFront(existing.id);
      return;
    }

    let detailData = { type: '', logic: '', annotations: [], edf_params: '{}', tuning_parameters: '{}', model_name: '' };
    
    try {
      const res = await fetch(`/api/tag/${currentStation.value}/${selectedDrawing.value}/${blockId}`);
      if (res.ok) {
        const dbData = await res.json();
        detailData = {
          type: dbData.custom_type || '',
          logic: dbData.custom_logic || '',
          annotations: dbData.annotations ? JSON.parse(dbData.annotations) : [],
          edf_params: dbData.edf_params,
          tuning_parameters: dbData.tuning_parameters,
          model_name: dbData.model_name
        };
      }
    } catch (e) { console.error("抓取詳細資料失敗", e); }

    // 🌟 手動補上圖檔所需變數
    detailData.station = currentStation.value; 
    detailData.svgFile = `${blockId}.svg`;

    const offset = (openModals.value.length % 5) * 3; 
    modalZIndexCounter++;
    openModals.value.push({
      id: `modal_${Date.now()}_${Math.random()}`,
      blockId: blockId,
      drawingId: selectedDrawing.value, 
      station: currentStation.value,
      zIndex: modalZIndexCounter,
      top: `${10 + offset}vh`,
      left: `${15 + offset}vw`,
      blockData: detailData
    });
  }

  const bringToFront = (modalId) => {
    const modal = openModals.value.find(m => m.id === modalId);
    if (modal) {
      modalZIndexCounter++;
      modal.zIndex = modalZIndexCounter;
    }
  }

  const closeDetailModal = (modalId) => {
    openModals.value = openModals.value.filter(m => m.id !== modalId);
  }

  // ==========================================
  // API 與系統邏輯
  // ==========================================
  const fetchAvailableDrawings = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const menuData = await res.json();
        let options = [];
        for (const [station, drawings] of Object.entries(menuData)) {
          drawings.forEach(dwg => {
            options.push({ value: dwg, label: dwg, category: station });
          });
        }
        drawingOptions.value = options;
        if (drawingOptions.value.length > 0 && !selectedDrawing.value) {
          selectedDrawing.value = drawingOptions.value[0].value;
          currentStation.value = drawingOptions.value[0].category;
        }
      }
    } catch (error) {}
  }

  const applyTagHighlights = () => {
    const container = document.querySelector('.svg-wrapper');
    if (!container) return;
    const textNodes = container.querySelectorAll('text, tspan');
    textNodes.forEach(node => {
      const text = node.textContent.trim();
      node.classList.remove('has-data-tag');
      if (text.length >= 2 && currentBlockData.value[text]) {
        node.classList.add('has-data-tag');
      }
    });
  }

  const loadSystemData = async () => {
    if (!selectedDrawing.value || !currentStation.value) return;
    
    // ✨ 1. 先清空舊圖與狀態，進入 Loading
    rawSvg.value = '';
    currentBlockData.value = {};
    annotations.value = [];
    isLoading.value = true;
    if (resetZoom) resetZoom(); 

    // ✨ 2. 強制讓 Vue 先更新一次畫面！確保外框選單和 Loading 字眼先顯示出來
    await nextTick();

    const svgUrl = `/data/${currentStation.value}/DRAWING/${selectedDrawing.value}/${selectedDrawing.value}.svg`;

    try {
      // ✨ 3. 將三次「排隊拿資料」升級成「同時派三個人去拿資料」(Promise.all)
      // 網路等待時間直接縮短成原本的三分之一！
      const [svgRes, tagsRes, annoRes] = await Promise.all([
        fetch(svgUrl),
        fetch(`/api/tags/${currentStation.value}/${selectedDrawing.value}`),
        fetch(`/api/custom_data/${currentStation.value}/${selectedDrawing.value}/MAIN_CANVAS`)
      ]);

      if (!svgRes.ok) throw new Error(`找不到底圖檔案`);
      const svgText = await svgRes.text();

      // 處理設備 Tag 清單
      if (tagsRes.ok) {
        const tagsArray = await tagsRes.json();
        let newBlockData = {};
        tagsArray.forEach(t => { newBlockData[t.tag_name] = true; });
        currentBlockData.value = newBlockData;
      }

      // 處理手繪標註
      if (annoRes.ok) {
        const annoData = await annoRes.json();
        annotations.value = annoData.annotations ? JSON.parse(annoData.annotations) : [];
      }

      // ✨ 4. 終極絕招：喘息機制 (setTimeout)
      // 資料雖然都拿到了，但先別急著塞 SVG！給瀏覽器 50 毫秒去把周圍的 UI 畫好，
      // 再把超巨大的 SVG 塞進畫布，這樣使用者就絕對不會感覺到瀏覽器死機。
      setTimeout(async () => {
        rawSvg.value = svgText;
        isLoading.value = false;
        await nextTick(); // 等待 SVG 真正長到 DOM 上面
        applyTagHighlights(); // 亮起設備底色
      }, 50);

    } catch (error) { 
      rawSvg.value = `
        <div style="color:#d63031; padding:30px; font-family:sans-serif; text-align:left; background:white; border-radius:8px;">
          <h2 style="margin-top:0;">❌ 無法顯示：找不到底圖檔案</h2>
          <div style="background:#f1f2f6; padding:15px; border-radius:8px; font-size:20px; font-weight:bold; color:#0984e3; margin-bottom:15px; border:2px dashed #74b9ff;">
            public${svgUrl}
          </div>
          <p style="font-size:16px; color:#2d3436;">請確認您的資料夾是否有放入對應的 SVG 圖檔。</p>
        </div>
      `;
      isLoading.value = false;
    }
  }

  const saveBlockText = async (station, drawingId, blockId, newData) => { 
    try {
      const res = await fetch(`/api/custom_data/${station}/${drawingId}/${blockId}`, { 
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newData.type, logic: newData.logic, annotations: newData.annotations || [] })
      });
      
      if (res.ok) {
        const modal = openModals.value.find(m => m.blockId === blockId && m.drawingId === drawingId && m.station === station);
        if (modal) { 
          modal.blockData = { ...modal.blockData, type: newData.type, logic: newData.logic, annotations: newData.annotations || [] };
        }
      }
    } catch (error) { alert('文字與標註儲存失敗'); }
  }

  // ✨ 上傳圖片 (必須是3個參數！)
  const handleFileUpload = async (drawingId, blockId, file) => { 
    const station = currentStation.value || 'FCS0101'; 
    
    const formData = new FormData();
    formData.append('station', station); 
    formData.append('drawingId', drawingId); 
    formData.append('blockId', blockId); 
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();
      
      if (result.success) {
        const tempUrl = URL.createObjectURL(file);
        const modal = openModals.value.find(m => m.blockId === blockId && m.drawingId === drawingId);
        if (modal) { 
          modal.blockData = { ...modal.blockData, svgFile: result.filename, customImageUrl: tempUrl };
        }
      } else {
        alert('❌ 上傳失敗！請檢查後端狀態。');
      }
    } catch (error) { 
      console.error(error);
      alert('伺服器連線錯誤'); 
    }
  }

  // ✨ 圖片刪除與錯誤處理防呆函數 (這些絕對不能刪，App.vue有用到！)
  const deleteBlockImage = async (drawingId, blockId) => { 
    const station = currentStation.value || 'FCS0101';
    if (!confirm(`確定要刪除 [ ${blockId} ] 的圖面嗎？`)) return;
    try {
      const res = await fetch(`/api/image/${station}/${drawingId}/${blockId}`, { method: 'DELETE' }); 
      if (res.ok) {
        const modal = openModals.value.find(m => m.blockId === blockId && m.drawingId === drawingId);
        if (modal) { 
          modal.blockData = { ...modal.blockData, svgFile: null, customImageUrl: null };
        }
      }
    } catch (error) { alert('刪除圖片失敗'); }
  }

  const handleImageError = (modalId) => { 
    const modal = openModals.value.find(m => m.id === modalId);
    if (modal && !modal.blockData.customImageUrl) {
      modal.blockData = { ...modal.blockData, svgFile: null };
    }
  }

  // ==========================================
  // ✨ 主圖紙：新增與刪除功能
  // ==========================================

  const onNewMainFileChange = (e) => { 
    newDrawing.value.file = e.target.files[0]; 
  }

  // ➕ 新增主圖紙
  const submitNewDrawing = async () => { 
    // 防呆：確認使用者都有填寫
    if (!newDrawing.value.category || !newDrawing.value.id || !newDrawing.value.file) {
      alert("請完整填寫站別、圖號，並選擇一份 SVG 檔案！");
      return;
    }

    // 將站別和圖號強制轉大寫，確保資料夾名稱一致性 (例如: fcs0101 -> FCS0101)
    const station = newDrawing.value.category.toUpperCase();
    const drawingId = newDrawing.value.id.toUpperCase();

    const formData = new FormData();
    formData.append('category', station);    // 傳送站別
    formData.append('drawingId', drawingId); // 傳送圖號
    formData.append('file', newDrawing.value.file);

    try {
      const response = await fetch('/api/upload-main', { method: 'POST', body: formData });
      const result = await response.json();
      
      if (result.success) {
        isAddMainModalOpen.value = false; // 關閉彈出視窗
        newDrawing.value = { id: '', name: '', category: '', file: null }; // 清空表單
        
        await fetchAvailableDrawings(); // 重新掃描硬碟，更新左側選單！
        
        // 自動幫使用者切換到剛上傳的新圖紙
        currentStation.value = station;
        selectedDrawing.value = drawingId;
        loadSystemData();
      } else {
        alert('❌ 新增失敗，請檢查後端狀態。');
      }
    } catch (error) { 
      console.error(error);
      alert('伺服器連線錯誤'); 
    }
  }

  // 🗑️ 刪除主圖紙
  const deleteCurrentDrawing = async () => { 
    if (!selectedDrawing.value || !currentStation.value) return;
    
    // 雙重確認，因為這會刪除整個資料夾與裡面所有小圖！
    if (!confirm(`⚠️ 警告：確定要刪除整個【 ${currentStation.value} - ${selectedDrawing.value} 】圖紙嗎？\n這將會從硬碟中刪除該目錄下所有的底圖與詳細圖檔，且無法復原！`)) {
      return;
    }

    try {
      const res = await fetch(`/api/drawings/${currentStation.value}/${selectedDrawing.value}`, { method: 'DELETE' }); 
      const result = await res.json();
      
      if (result.success) {
        // 清空當前畫面
        selectedDrawing.value = '';
        rawSvg.value = '';
        annotations.value = [];
        currentBlockData.value = {};
        
        await fetchAvailableDrawings(); // 重新掃描硬碟，把左側選單的這張圖拔掉！
      } else {
        alert('❌ 刪除失敗');
      }
    } catch (error) { 
      console.error(error);
      alert('伺服器連線錯誤'); 
    }
  }

  // 編輯名稱先留著（因為牽涉到改作業系統實體資料夾名稱，比較複雜，可以先用刪除+重新上傳代替）
  const editCurrentDrawing = async () => { alert("重新命名功能建置中，請先使用刪除後重新上傳") }

  // 確保輸出的東西跟 App.vue 要的一模一樣！
  return {
    drawingOptions, groupedDrawings, selectedDrawing, currentStation, rawSvg, currentBlockData, isLoading, annotations,
    isAddMainModalOpen, newDrawing,
    openModals, openDetailModal, closeDetailModal, bringToFront,
    fetchAvailableDrawings, applyTagHighlights, loadSystemData, editCurrentDrawing,
    deleteCurrentDrawing, onNewMainFileChange, submitNewDrawing,
    saveBlockText, handleFileUpload, deleteBlockImage, handleImageError
  }
}
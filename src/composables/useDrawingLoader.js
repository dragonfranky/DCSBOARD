// src/composables/useDrawingLoader.js
import { ref, watch } from 'vue'

export function useDrawingLoader(props) {
  const fetchedSvgContent = ref('')
  const isInlineSvg = ref(false)

  // 🌟 這是關鍵：主畫面怎麼抓，這裡就怎麼抓
  const getImageUrl = () => {
    // 1. 優先判斷是否有自訂上傳圖
    if (props.blockData?.customImageUrl) return props.blockData.customImageUrl;

    // 2. 獲取站號 (Station)，主畫面抓不到時通常預設 FCS0101
    const station = props.blockData?.station || 'FCS0101';
    
    // 3. 獲取圖號 (Drawing)，對應資料夾名稱
    const drawingFolder = props.selectedDrawing;
    
    // 4. 獲取檔名 (svgFile)
    const fileName = props.blockData?.svgFile;

    // 🔴 偵錯檢查：如果這三個變數缺一個，路徑就會斷掉
    if (!station || !drawingFolder || !fileName) {
      return '';
    }

    // 🌟 組裝與主畫面一致的絕對路徑
    // public/data/FCS0101/DRAWING/DR0001/STCOM.svg
    return `/data/${station}/DRAWING/${drawingFolder}/${fileName}`;
  };

  // 監聽內容變化，抓取 SVG 內聯代碼
  watch(() => [props.blockData?.svgFile, props.isOpen, props.selectedDrawing], async ([file, isOpen]) => {
    if (!isOpen || !file || !file.toLowerCase().endsWith('.svg')) {
      isInlineSvg.value = false;
      fetchedSvgContent.value = '';
      return;
    }

    const url = getImageUrl();
    if (!url) return;

    try {
      const res = await fetch(url);
      if (res.ok) {
        let svgText = await res.text();
        const suffix = '_' + Math.random().toString(36).substring(2, 8);
        svgText = svgText.replace(/id="([^"]+)"/g, `id="$1${suffix}"`);
        svgText = svgText.replace(/url\(['"]?#([^)'"]+)['"]?\)/g, `url(#$1${suffix})`);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgEl = doc.documentElement;
        
        if (!svgEl.getAttribute('viewBox')) {
          const w = svgEl.getAttribute('width') || '1000';
          const h = svgEl.getAttribute('height') || '1000';
          svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');

        fetchedSvgContent.value = svgEl.outerHTML;
        isInlineSvg.value = true;
      }
    } catch (err) {
      console.error('[DrawingLoader] 載入失敗:', err);
    }
  }, { immediate: true });

  return { fetchedSvgContent, isInlineSvg, getImageUrl };
}
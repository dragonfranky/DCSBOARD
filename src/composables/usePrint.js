import { nextTick } from 'vue'

export function usePrint() {
  
  // 主畫面列印邏輯 (橫印)
  const printMain = async (resetZoomCallback) => {
    if (resetZoomCallback) resetZoomCallback(); 
    await nextTick();
    
    // ✨ 動態注入「橫印」設定
    const pageStyle = document.createElement('style');
    pageStyle.id = 'print-page-style';
    pageStyle.innerHTML = '@page { size: landscape; margin: 5mm; }';
    document.head.appendChild(pageStyle);
    
    setTimeout(() => {
      document.body.classList.add('print-main-mode'); 
      
      window.print(); 
      
      document.body.classList.remove('print-main-mode'); 
      document.head.removeChild(pageStyle); // 印完後清理乾淨
    }, 300);
  };

  // 彈出視窗(詳細圖面)列印邏輯 (直印)
  const printModal = async (resetZoomCallback, modalElement) => {
    if (resetZoomCallback) resetZoomCallback(); 
    await nextTick();
    
    // ✨ 動態注入「直印」設定
    const pageStyle = document.createElement('style');
    pageStyle.id = 'print-page-style';
    pageStyle.innerHTML = '@page { size: portrait; margin: 5mm; }';
    document.head.appendChild(pageStyle);
    
    setTimeout(() => {
      document.body.classList.add('print-modal-mode'); 
      if (modalElement) modalElement.classList.add('is-printing-target'); 
      
      window.print(); 
      
      document.body.classList.remove('print-modal-mode'); 
      if (modalElement) modalElement.classList.remove('is-printing-target');
      document.head.removeChild(pageStyle); // 印完後清理乾淨
    }, 300);
  };

  return { 
    printMain, 
    printModal 
  }
}
import { ref } from 'vue'

export function useAnnotations(annotations, scale, translateX, translateY, saveCallback) {
  const isAnnotationMode = ref(false);
  const isAnnoInputOpen = ref(false);
  // ✨ 加上 type 屬性，預設為 'bubble' (氣泡)
  const draftAnno = ref({ targetX: 0, targetY: 0, x: 0, y: 0, text: '', id: null, color: '#e74c3c', fontSize: 14, type: 'bubble' });

  const confirmAddAnno = async () => {
    // ✨ 對話框模式必須有字，但如果是圖形框，允許沒有文字！
    if ((!draftAnno.value.type || draftAnno.value.type === 'bubble') && !draftAnno.value.text.trim()) { 
      isAnnoInputOpen.value = false; return; 
    }
    
    if (draftAnno.value.id) {
      const index = annotations.value.findIndex(a => a.id === draftAnno.value.id);
      if (index > -1) {
        annotations.value[index].text = draftAnno.value.text.trim();
        annotations.value[index].color = draftAnno.value.color;
        annotations.value[index].fontSize = draftAnno.value.fontSize;
        annotations.value[index].type = draftAnno.value.type || 'bubble'; // ✨ 儲存類型
      }
    } else {
      annotations.value.push({
        id: 'anno_' + Date.now(),
        targetX: draftAnno.value.targetX,
        targetY: draftAnno.value.targetY,
        x: draftAnno.value.x,
        y: draftAnno.value.y,
        text: draftAnno.value.text.trim(),
        color: draftAnno.value.color || '#e74c3c',
        fontSize: draftAnno.value.fontSize || 14,
        type: draftAnno.value.type || 'bubble' // ✨ 儲存類型
      });
    }
    
    if (saveCallback) await saveCallback(annotations.value); 
    isAnnoInputOpen.value = false;
  };

  const editAnnotation = (anno) => { 
    // ✨ 編輯時帶入類型，相容舊有資料
    draftAnno.value = { color: '#e74c3c', fontSize: 14, type: 'bubble', ...anno }; 
    isAnnoInputOpen.value = true; 
  };

  const deleteAnnotation = async (id) => {
    if (!confirm('確定要刪除這個標註嗎？')) return;
    const index = annotations.value.findIndex(a => a.id === id);
    if (index > -1) {
      annotations.value.splice(index, 1);
      if (saveCallback) await saveCallback(annotations.value); 
    }
  };

  const startDragAnno = (e, anno, type) => {
    e.stopPropagation();
    e.preventDefault(); 
    const startX = e.clientX, startY = e.clientY, origX = anno.x, origY = anno.y, origTargetX = anno.targetX, origTargetY = anno.targetY;
    
    const onDrag = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale.value;
      const dy = (moveEvent.clientY - startY) / scale.value;
      if (type === 'bubble') { anno.x = origX + dx; anno.y = origY + dy; } 
      else if (type === 'target') { anno.targetX = origTargetX + dx; anno.targetY = origTargetY + dy; }
    };
    
    const onDrop = async () => {
      document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', onDrop);
      if (saveCallback) await saveCallback(annotations.value); 
    };
    
    document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', onDrop);
  };

  return { isAnnotationMode, isAnnoInputOpen, draftAnno, confirmAddAnno, deleteAnnotation, startDragAnno, editAnnotation }
}
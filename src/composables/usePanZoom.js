import { ref, computed } from 'vue'

export function useMainPanZoom() {
  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  
  const hasDragged = ref(false) // 改用 ref 讓外部可以讀取狀態
  let isPanning = false
  let startX = 0
  let startY = 0

  const panZoomStyle = computed(() => ({
    transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
    transformOrigin: '0 0',
  }))

  const resetZoom = () => {
    scale.value = 1; translateX.value = 0; translateY.value = 0;
  }

  const handleWheel = (e) => {
    const zoomSensitivity = 0.1
    const delta = e.deltaY < 0 ? 1 : -1
    const zoomFactor = 1 + (delta * zoomSensitivity)
    const newScale = Math.max(0.1, Math.min(scale.value * zoomFactor, 10))
    
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const xs = (mouseX - translateX.value) / scale.value
    const ys = (mouseY - translateY.value) / scale.value

    scale.value = newScale
    translateX.value = mouseX - xs * scale.value
    translateY.value = mouseY - ys * scale.value
  }

  const startPan = (e) => {
    if (e.button !== 0) return 

    // ✨ 關鍵修復：無論點擊到什麼元素，只要滑鼠按下去，就先清除「上一次」殘留的拖曳狀態！
    hasDragged.value = false

    // ✨ 新增盤查邏輯：如果點擊的是文字，就直接放行，讓瀏覽器可以原生反白選取！
    const targetTag = e.target.tagName.toLowerCase()
    if (targetTag === 'text' || targetTag === 'tspan') {
      return 
    }

    e.preventDefault()
    isPanning = true
    startX = e.clientX - translateX.value
    startY = e.clientY - translateY.value
    document.addEventListener('mousemove', pan)
    document.addEventListener('mouseup', endPan)
  }

  const pan = (e) => {
    if (!isPanning) return
    hasDragged.value = true 
    translateX.value = e.clientX - startX
    translateY.value = e.clientY - startY
  }

  const endPan = () => {
    isPanning = false
    document.removeEventListener('mousemove', pan)
    document.removeEventListener('mouseup', endPan)
  }

  return {
    scale, translateX, translateY, hasDragged, panZoomStyle,
    resetZoom, handleWheel, startPan
  }
}

export function useModalPanZoom() {
  const modalScale = ref(1)
  const modalTranslateX = ref(0)
  const modalTranslateY = ref(0)

  let isModalPanning = false
  let modalStartX = 0
  let modalStartY = 0

  const modalPanZoomStyle = computed(() => ({
    transform: `translate(${modalTranslateX.value}px, ${modalTranslateY.value}px) scale(${modalScale.value})`,
    transformOrigin: '0 0'
  }))

  const resetModalZoom = () => {
    modalScale.value = 1; modalTranslateX.value = 0; modalTranslateY.value = 0;
  }

  const handleModalWheel = (e) => {
    const zoomSensitivity = 0.1
    const delta = e.deltaY < 0 ? 1 : -1
    const zoomFactor = 1 + (delta * zoomSensitivity)
    const newScale = Math.max(0.1, Math.min(modalScale.value * zoomFactor, 10))
    
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const xs = (mouseX - modalTranslateX.value) / modalScale.value
    const ys = (mouseY - modalTranslateY.value) / modalScale.value

    modalScale.value = newScale
    modalTranslateX.value = mouseX - xs * modalScale.value
    modalTranslateY.value = mouseY - ys * modalScale.value
  }

  const startModalPan = (e) => {
    if (e.button !== 0) return
    
    // ✨ 新增盤查邏輯：如果點擊的是 SVG 裡的文字，直接放行讓瀏覽器可以反白！
    const targetTag = e.target.tagName.toLowerCase()
    if (targetTag === 'text' || targetTag === 'tspan') {
      return 
    }

    e.preventDefault()
    isModalPanning = true
    modalStartX = e.clientX - modalTranslateX.value
    modalStartY = e.clientY - modalTranslateY.value
    document.addEventListener('mousemove', modalPan)
    document.addEventListener('mouseup', endModalPan)
  }

  const modalPan = (e) => {
    if (!isModalPanning) return
    modalTranslateX.value = e.clientX - modalStartX
    modalTranslateY.value = e.clientY - modalStartY
  }

  const endModalPan = () => {
    isModalPanning = false
    document.removeEventListener('mousemove', modalPan)
    document.removeEventListener('mouseup', endModalPan)
  }

  return {
    modalScale, modalTranslateX, modalTranslateY, modalPanZoomStyle,
    resetModalZoom, handleModalWheel, startModalPan
  }
}
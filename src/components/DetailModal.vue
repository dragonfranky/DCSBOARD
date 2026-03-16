<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="modalRef"
      class="modal detail-modal"
      :style="{ zIndex: zIndex, top: localTop, left: localLeft }"
      @mousedown="$emit('focus')"
    >
      <div class="modal-header" @mousedown="startDrag">
        <h3 style="margin: 0; font-size: 16px;">
          ⚙️ 設備詳細資訊 - [ {{ blockId }} ]
        </h3>
        <button @click="$emit('close')" class="icon-btn close-btn">✖</button>
      </div>

      <div class="modal-body">
        
        <div class="data-panels">
          
          <div class="panel custom-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <h4 style="margin: 0;">📝 自訂筆記</h4>
              <button v-if="!isEditingText" @click="startEdit" class="icon-btn" style="padding: 2px 5px; font-size: 12px;">✏️ 編輯</button>
            </div>
            
            <div v-if="isEditingText" class="edit-box">
              <input v-model="tempTextData.type" class="edit-input" placeholder="例如：水泵、控制閥..." style="margin-bottom: 5px; padding: 4px;"/>
              <textarea v-model="tempTextData.logic" class="edit-input" rows="2" placeholder="請輸入控制邏輯..." style="padding: 4px;"></textarea>
              <div style="text-align: right; margin-top: 5px;">
                <button @click="isEditingText = false" class="icon-btn" style="padding: 2px 5px; font-size: 12px;">取消</button>
                <button @click="saveText" class="icon-btn save-btn" style="background: #2ecc71; color: white; padding: 2px 5px; font-size: 12px;">💾 儲存</button>
              </div>
            </div>
            <div v-else class="info-box">
              <p style="margin: 2px 0; font-size: 13px;"><strong>類型：</strong> {{ blockData.type || '(未設定)' }}</p>
              <p style="margin: 2px 0; font-size: 13px;"><strong>邏輯：</strong> {{ blockData.logic || '(未設定)' }}</p>
            </div>
          </div>

          <div class="panel edf-panel">
            <h4 style="margin: 0 0 5px 0;">⚙️ EDF 組態 <span v-if="blockData.model_name" style="color:blue;">({{ blockData.model_name }})</span></h4>
            <div class="table-container">
              <table v-if="blockData.edf_params && blockData.edf_params !== '{}'" class="param-table">
                <tbody>
                  <template v-for="item in getSortedEdfParams(blockData.edf_params)" :key="item.rawKey || item.label">
                    
                    <tr v-if="item.isHeader" style="background-color: #e2e8f0;">
                      <td colspan="2" style="font-weight: bold; color: #1e293b; text-align: left; padding: 6px 10px; border-bottom: 2px solid #cbd5e1;">
                        ■ {{ item.label }}
                      </td>
                    </tr>

                    <tr v-else>
                      <th>
                        <div style="font-weight: bold; color: #333;">{{ item.label }}</div>
                        <div style="font-size: 10px; color: #999; font-weight: normal;">{{ item.rawKey }}</div>
                      </th>
                      <td style="color: #333; white-space: pre-wrap; line-height: 1.4;">{{ item.value }}</td>
                    </tr>
                    
                  </template>
                </tbody>
              </table>
              <div v-else class="empty-msg">無 EDF 資料</div>
            </div>
          </div>

          <div class="panel tuning-panel">
            <h4 style="margin: 0 0 5px 0;">📈 Tuning 參數</h4>
            <div class="table-container">
              <table v-if="blockData.tuning_parameters && blockData.tuning_parameters !== '{}'" class="param-table">
                <tbody>
                  <tr v-for="(row, idx) in getSortedTuningParams(blockData.tuning_parameters)" :key="'tuning-'+idx">
                    
                    <template v-if="row.left">
                      <th style="width: 20%; color: #333;">{{ row.left.key }}</th>
                      <td style="width: 30%; color: #0056b3;">{{ row.left.val }}</td>
                    </template>
                    <template v-else>
                      <th style="width: 20%;"></th><td style="width: 30%;"></td>
                    </template>

                    <template v-if="row.right">
                      <th style="width: 20%; color: #333; border-left: 2px solid #ccc;">{{ row.right.key }}</th>
                      <td style="width: 30%; color: #0056b3;">{{ row.right.val }}</td>
                    </template>
                    <template v-else>
                      <th style="width: 20%; border-left: 2px solid #ccc;"></th><td style="width: 30%;"></td>
                    </template>

                  </tr>
                </tbody>
              </table>
              <div v-else class="empty-msg">無 Tuning 資料</div>
            </div>
          </div>

        </div>

        <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;" />

        <div class="image-header">
          <span style="font-weight: bold; color: #555;">🎨 關聯圖紙：</span>
          <div>
            <button class="icon-btn" :class="{ 'active-mode': isModalAnnotationMode }" @click="isModalAnnotationMode = !isModalAnnotationMode" title="新增標註">
              💬 {{ isModalAnnotationMode ? '取消標註' : '新增對話框' }}
            </button>
            <button @click="resetModalZoom" class="icon-btn" title="重設視角">🏠 重設</button>
            <button @click="handlePrintModal" class="icon-btn" title="列印此圖面" style="margin-right: 5px;">🖨️ 列印</button>
            <label class="icon-btn" style="cursor: pointer;">
              ⬆️ 上傳圖面
              <input type="file" @change="onFileChange" accept="image/svg+xml, image/png, image/jpeg" style="display: none;" />
            </label>
            <button v-if="blockData.customImageUrl || blockData.svgFile" @click="$emit('deleteImage', blockId)" class="icon-btn delete-icon">🗑️ 刪除</button>
          </div>
        </div>

        <div class="image-container" style="flex: 1; overflow: hidden; position: relative; border: 1px solid #ddd; background: #fafafa; border-radius: 4px; margin-top: 5px;">
          <div v-if="blockData.customImageUrl || blockData.svgFile" class="modal-img-viewport" @wheel.prevent="handleModalWheel" @mousedown="startModalPan" style="width: 100%; height: 100%; overflow: hidden;">
            <div class="modal-svg-wrapper" :style="modalPanZoomStyle" @click="handleModalImgClick">
              <img
                v-if="blockData.customImageUrl || !isInlineSvg"
                :src="getImageUrl()"
                alt="詳細圖面"
                @error="$emit('imageError', blockId)"
                class="modal-img-wrapper"
                draggable="false"
              >
              
              <div 
                v-else 
                v-html="fetchedSvgContent" 
                class="modal-img-wrapper inline-svg"
              ></div>
              <AnnotationLayer
                :annotations="modalAnnotations"
                :scale="modalScale"
                :isAnnoInputOpen="isModalAnnoInputOpen"
                :draftAnno="modalDraftAnno"
                @updateDraftText="modalDraftAnno.text = $event"
                @updateDraftColor="modalDraftAnno.color = $event"
                @updateDraftFontSize="modalDraftAnno.fontSize = $event"
                @updateDraftType="modalDraftAnno.type = $event"
                @closeModal="isModalAnnoInputOpen = false"
                @confirmAdd="confirmModalAddAnno"
                @startDrag="startModalDragAnno"
                @delete="deleteModalAnnotation"
                @edit="editModalAnnotation"
              />
            </div>
          </div>
          <div v-else style="padding: 40px; text-align: center; color: #999;">
            目前無附加圖面，請點擊上方按鈕上傳。
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useModalPanZoom } from '../composables/usePanZoom'
import AnnotationLayer from './AnnotationLayer.vue'
import { useAnnotations } from '../composables/useAnnotations'
import { usePrint } from '../composables/usePrint' 
import { useEdfParser } from '../composables/useEdfParser'
import { useTuningParser } from '../composables/useTuningParser'

// ✨ 1. 引入圖紙載入模組
import { useDrawingLoader } from '../composables/useDrawingLoader'

const props = defineProps({
  isOpen: Boolean,
  blockId: String,
  blockData: Object,
  selectedDrawing: String,
  zIndex: Number,
  top: String,
  left: String
})

const emit = defineEmits(['close', 'saveText', 'uploadImage', 'deleteImage', 'imageError', 'focus'])

const { getSortedEdfParams } = useEdfParser()
const { getSortedTuningParams } = useTuningParser()

// ✨ 2. 啟動圖紙載入模組
const { fetchedSvgContent, isInlineSvg, getImageUrl } = useDrawingLoader(props)

const modalRef = ref(null)
const localTop = ref(props.top)
const localLeft = ref(props.left)

const { modalScale, modalTranslateX: localTranslateX, modalTranslateY: localTranslateY, modalPanZoomStyle, resetModalZoom, handleModalWheel, startModalPan } = useModalPanZoom()
const { printModal } = usePrint();
const handlePrintModal = () => { printModal(resetModalZoom, modalRef.value); };

watch(() => props.isOpen, (newVal) => { if (newVal) resetModalZoom() })

// ==========================================
// 下方保留標註、文字編輯與拖曳視窗的邏輯
// ==========================================

const modalAnnotations = ref(props.blockData.annotations || [])
const saveModalAnnotations = (newAnnos) => {
  emit('saveText', props.blockId, { type: props.blockData.type || '', logic: props.blockData.logic || '', annotations: newAnnos })
}

watch(() => props.blockData.annotations, (newAnnos) => {
  if (newAnnos) modalAnnotations.value = newAnnos;
}, { deep: true });

const { isAnnotationMode: isModalAnnotationMode, isAnnoInputOpen: isModalAnnoInputOpen, draftAnno: modalDraftAnno, confirmAddAnno: confirmModalAddAnno, deleteAnnotation: deleteModalAnnotation, startDragAnno: startModalDragAnno, editAnnotation: editModalAnnotation } = useAnnotations(modalAnnotations, modalScale, localTranslateX, localTranslateY, saveModalAnnotations)

const handleModalImgClick = (e) => {
  if (!isModalAnnotationMode.value) return;
  const viewport = e.currentTarget.closest('.modal-img-viewport') || e.currentTarget;
  const rect = viewport.getBoundingClientRect();
  const x = (e.clientX - rect.left - localTranslateX.value) / modalScale.value;
  const y = (e.clientY - rect.top - localTranslateY.value) / modalScale.value;
  modalDraftAnno.value = { targetX: x, targetY: y, x: x + 100, y: y - 80, text: '', id: null, color: '#e74c3c', fontSize: 14, type: 'bubble' };
  isModalAnnoInputOpen.value = true;
  isModalAnnotationMode.value = false;
}

const isEditingText = ref(false)
const tempTextData = ref({ type: '', logic: '' })

const startEdit = () => {
  tempTextData.value = { type: props.blockData.type || '', logic: props.blockData.logic || '' }
  isEditingText.value = true
}

const saveText = () => {
  emit('saveText', props.blockId, { ...tempTextData.value, annotations: modalAnnotations.value })
  isEditingText.value = false
}

// 📸 觸發上傳事件給外層
const onFileChange = (event) => { 
  const file = event.target.files[0]; 
  if (file) emit('uploadImage', props.blockId, file) 
}

const startDrag = (e) => {
  if (e.target.tagName.toLowerCase() === 'button') return;
  const modal = e.target.closest('.modal')
  if (!modal) return
  let startX = e.clientX, startY = e.clientY, initialTop = modal.offsetTop, initialLeft = modal.offsetLeft
  const onMouseMove = (moveEvent) => {
    localTop.value = `${initialTop + moveEvent.clientY - startY}px`
    localLeft.value = `${initialLeft + moveEvent.clientX - startX}px`
  }
  const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
  document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.detail-modal { position: fixed; width: 75vw; height: 85vh; min-width: 600px; min-height: 400px; resize: both; background-color: white; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; }
.modal-header { padding: 10px 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; cursor: move; }
.modal-body { padding: 15px; display: flex; flex-direction: column; height: calc(100% - 45px); box-sizing: border-box; overflow: hidden; }

/* ✨ 三宮格數據區 CSS */
.data-panels { display: flex; gap: 10px; height: 180px; min-height: 180px; }
.panel { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 10px; background: #fff; display: flex; flex-direction: column; }
.panel h4 { border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333; }
.table-container { flex: 1; overflow-y: auto; }
.param-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.param-table th, .param-table td { border: 1px solid #eee; padding: 4px 6px; text-align: left; }
.param-table th { background: #f4f6f8; width: 40%; color: #555; }
.empty-msg { color: #aaa; font-size: 13px; margin-top: 10px; text-align: center; }

.image-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.modal-svg-wrapper { display: inline-block; position: relative; transform-origin: 0 0; }
.modal-img-wrapper { display: block; width: 1000px !important; height: auto !important; object-fit: contain; pointer-events: none; max-width: none !important; }
.active-mode { background-color: #f39c12 !important; color: white !important; border-color: #e67e22 !important; font-weight: bold; }

.inline-svg :deep(svg) { width: 100% !important; height: auto !important; display: block; overflow: visible !important; }
.inline-svg { pointer-events: auto !important; height: auto !important; }
:deep(.inline-svg text), :deep(.inline-svg tspan) { cursor: text !important; user-select: text !important; pointer-events: auto !important; }
</style>
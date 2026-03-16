<template>
  <svg class="anno-svg-layer">
    <defs>
      <marker v-for="anno in annotations.filter(a => a.type === 'arrow')" :key="'marker_'+anno.id"
        :id="'arrow_' + anno.id" orient="auto" markerWidth="12" markerHeight="10" refX="9" refY="5">
        <polygon points="0,2 10,5 0,8" :fill="anno.color || '#e74c3c'" />
      </marker>
    </defs>

    <template v-for="anno in annotations" :key="'shape_'+anno.id">
      <line v-if="!anno.type || anno.type === 'bubble'"
            :x1="anno.x" :y1="anno.y" :x2="anno.targetX" :y2="anno.targetY"
            :stroke="anno.color || '#2c3e50'" :stroke-width="3 / scale" />
      
      <line v-else-if="anno.type === 'arrow'"
            :x1="anno.x" :y1="anno.y" :x2="anno.targetX" :y2="anno.targetY"
            :stroke="anno.color || '#e74c3c'" :stroke-width="2 / scale"
            :marker-end="'url(#arrow_' + anno.id + ')'" />

      <rect v-else-if="anno.type === 'rect'"
            :x="Math.min(anno.x, anno.targetX)" :y="Math.min(anno.y, anno.targetY)"
            :width="Math.abs(anno.x - anno.targetX)" :height="Math.abs(anno.y - anno.targetY)"
            fill="rgba(255,255,255,0.1)" :stroke="anno.color || '#e74c3c'" :stroke-width="3 / scale" />

      <ellipse v-else-if="anno.type === 'circle'"
               :cx="(anno.x + anno.targetX) / 2" :cy="(anno.y + anno.targetY) / 2"
               :rx="Math.abs(anno.x - anno.targetX) / 2" :ry="Math.abs(anno.y - anno.targetY) / 2"
               fill="rgba(255,255,255,0.1)" :stroke="anno.color || '#e74c3c'" :stroke-width="3 / scale" />
    </template>
  </svg>

  <div v-for="anno in annotations" :key="anno.id">
    <div class="anno-target" :style="{ left: anno.targetX + 'px', top: anno.targetY + 'px', transform: `translate(-50%, -50%) scale(${1 / scale})` }"
         @mousedown.stop="$emit('startDrag', $event, anno, 'target')" title="拖曳以改變形狀/目標">🔴</div>
    
    <div v-if="!anno.type || anno.type === 'bubble'" class="comic-bubble" 
         :style="{ left: anno.x + 'px', top: anno.y + 'px', transform: `translate(-50%, -50%) scale(${1 / scale})`, borderColor: anno.color || '#2c3e50', color: anno.color || '#e74c3c', fontSize: (anno.fontSize || 14) + 'px' }"
         @mousedown.stop="handleDragStart($event, anno, 'bubble')" @dblclick.stop="$emit('edit', anno)" title="連點兩下修改文字">
      {{ anno.text }}
      <button class="delete-anno-btn" @mousedown.stop @click.stop="$emit('delete', anno.id)">×</button>
    </div>

    <div v-else class="shape-anchor" :style="{ left: anno.x + 'px', top: anno.y + 'px', transform: `translate(-50%, -50%) scale(${1 / scale})`, color: anno.color || '#e74c3c', fontSize: (anno.fontSize || 14) + 'px' }"
         @mousedown.stop="handleDragStart($event, anno, 'bubble')" @dblclick.stop="$emit('edit', anno)" title="連點兩下修改文字">
      <span style="display: inline-flex; align-items: flex-start;">
        📍 <span v-if="anno.text" class="shape-text">{{ anno.text }}</span>
      </span>
      <button class="delete-anno-btn" @mousedown.stop @click.stop="$emit('delete', anno.id)">×</button>
    </div>
  </div>

  <Teleport to="body" v-if="isAnnoInputOpen">
    <div class="overlay"></div>
    <div class="modal anno-input-modal">
      <h3 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50;">✍️ 新增 / 編輯標註</h3>
      
      <div class="style-controls" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 6px; flex-wrap: wrap;">
        
        <div style="display: flex; gap: 10px; width: 100%; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 5px;">
          <label style="cursor: pointer;"><input type="radio" name="annoType" :checked="!draftAnno.type || draftAnno.type === 'bubble'" @change="$emit('updateDraftType', 'bubble')"> 💬 氣泡</label>
          <label style="cursor: pointer;"><input type="radio" name="annoType" :checked="draftAnno.type === 'arrow'" @change="$emit('updateDraftType', 'arrow')"> ↗️ 箭頭</label>
          <label style="cursor: pointer;"><input type="radio" name="annoType" :checked="draftAnno.type === 'rect'" @change="$emit('updateDraftType', 'rect')"> ⬜ 方框</label>
          <label style="cursor: pointer;"><input type="radio" name="annoType" :checked="draftAnno.type === 'circle'" @change="$emit('updateDraftType', 'circle')"> ◯ 圓框</label>
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px; margin-right: auto;">
          <span style="font-size: 14px; font-weight: bold; color: #555;">🎨 顏色：</span>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; max-width: 140px;">
            <div v-for="color in presetColors" :key="color"
                 class="color-swatch"
                 :class="{ active: (draftAnno.color || '#e74c3c') === color }"
                 :style="{ backgroundColor: color }"
                 @click="$emit('updateDraftColor', color)"
                 :title="color">
            </div>
          </div>
        </div>

        <label style="font-size: 14px; font-weight: bold; color: #555; display: flex; align-items: center; gap: 5px; margin-left: auto;">
          🔠 大小：<input type="number" :value="draftAnno.fontSize || 14" @input="$emit('updateDraftFontSize', parseInt($event.target.value))" min="10" max="48" style="width: 50px; padding: 2px 5px; border-radius: 4px; border: 1px solid #ccc;"> px
        </label>
      </div>

      <textarea :value="draftAnno.text" @input="$emit('updateDraftText', $event.target.value)" rows="4" class="anno-textarea" placeholder="請輸入標註內容... (若是繪製圖形，此欄可留白)"></textarea>
      
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button @click="$emit('closeModal')" class="submit-btn cancel-btn">取消</button>
        <button @click="$emit('confirmAdd')" class="submit-btn save-btn">✅ 確認儲存</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const presetColors = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', 
  '#3498db', '#9b59b6', '#34495e', '#95a5a6'
]

const props = defineProps({ annotations: Array, scale: Number, isAnnoInputOpen: Boolean, draftAnno: Object })
const emit = defineEmits(['startDrag', 'delete', 'closeModal', 'updateDraftText', 'updateDraftColor', 'updateDraftFontSize', 'updateDraftType', 'confirmAdd', 'edit'])

// ✨ 智能拖曳判斷：閃避 Resize 區域
const handleDragStart = (e, anno, type) => {
  // 如果點擊的是氣泡框，且滑鼠位置在右下角的 20x20 pixel 區域內
  if (e.target.classList.contains('comic-bubble')) {
    const isResizing = (e.offsetX > e.target.clientWidth - 20) && (e.offsetY > e.target.clientHeight - 20);
    if (isResizing) {
      return; // 放行！不觸發自訂拖曳，讓瀏覽器原生 Resize 介入
    }
  }
  emit('startDrag', e, anno, type);
}
</script>

<style scoped>
.anno-svg-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 40; overflow: visible; }

/* 🔴 紅點縮小並微調 */
.anno-target { position: absolute; font-size: 8px; cursor: grab; z-index: 45; user-select: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.anno-target:active { cursor: grabbing; }

.comic-bubble { position: absolute; background: white; border: 2px solid #2c3e50; border-radius: 8px; padding: 10px 15px; min-width: 100px; max-width: none; text-align: left; box-shadow: 2px 4px 8px rgba(0,0,0,0.2); font-weight: bold; white-space: pre-wrap; word-break: break-all; cursor: grab; z-index: 50; resize: both; overflow: auto; }
.comic-bubble:active { cursor: grabbing; box-shadow: 4px 8px 15px rgba(0,0,0,0.3); }
.comic-bubble .delete-anno-btn { position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 14px; cursor: pointer; display: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height: 1; padding: 0; }
.comic-bubble:hover .delete-anno-btn { display: block; }

/* ✨ 拔掉 nowrap，讓它自然生長 */
.shape-anchor { position: absolute; cursor: grab; z-index: 50; font-weight: bold; text-shadow: 1px 1px 2px white, -1px -1px 2px white; }
.shape-anchor:active { cursor: grabbing; }

/* ✨ 加入 pre-wrap 與限制寬度，完美支援多行文字斷行 */
.shape-text { 
  background: rgba(255,255,255,0.85); 
  padding: 4px 8px; 
  border-radius: 4px; 
  border: 1px solid #ccc; 
  box-shadow: 1px 2px 4px rgba(0,0,0,0.1); 
  margin-left: 5px; 
  white-space: pre-wrap;     /* 允許換行 */
  word-break: break-all;     /* 避免長串英文超出邊界 */
  text-align: left; 
  max-width: 250px;          /* 限制最大寬度，避免文字無限拉長 */
  display: inline-block;     /* 確保多行時背景框包覆正確 */
  vertical-align: top;       /* 讓前方的 📍 對齊第一行文字 */
}
.shape-anchor .delete-anno-btn { position: absolute; top: -15px; right: -5px; background: #e74c3c; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 14px; cursor: pointer; display: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height: 1; padding: 0; }
.shape-anchor:hover .delete-anno-btn { display: block; }

.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99998 !important; }
.modal { position: fixed; background: white; border-radius: 8px; z-index: 99999 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; display: flex; flex-direction: column; }
.anno-input-modal { top: 25vh; left: 50%; transform: translateX(-50%); width: 380px; padding: 20px; }
.anno-textarea { width: 100%; box-sizing: border-box; padding: 10px; margin-bottom: 15px; border-radius: 6px; border: 1px solid #ccc; font-size: 14px; resize: vertical; }

.submit-btn { background: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; }
.submit-btn:hover { background: #2980b9; }
.save-btn { background: #2ecc71; }
.save-btn:hover { background: #27ae60; }
.cancel-btn { background: #95a5a6; }
.cancel-btn:hover { background: #7f8c8d; }

.color-swatch { width: 22px; height: 22px; border-radius: 4px; cursor: pointer; border: 2px solid transparent; box-sizing: border-box; transition: transform 0.1s, border-color 0.1s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.color-swatch:hover { transform: scale(1.1); }
.color-swatch.active { border-color: #2c3e50; transform: scale(1.15); box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
</style>
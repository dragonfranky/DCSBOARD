<template>
  <Teleport to="body">
    <div v-if="isOpen" class="overlay"></div>
    <div v-if="isOpen" class="modal add-main-modal">
      <div class="modal-header">
        <h3>➕ 新增主圖紙</h3>
        <button class="close-btn" @click="$emit('close')">✖ 關閉</button>
      </div>
      <div class="modal-body">
        
        <div class="form-group">
          <label>🏢 站別 (必填，如 FCS0101)：</label>
          <input 
            v-model="newDrawing.category" 
            type="text" 
            placeholder="請輸入系統站別 (例如: FCS0101)"
            style="text-transform: uppercase;"
          >
        </div>

        <div class="form-group">
          <label>📄 圖紙代號 (必填，如 DR0001)：</label>
          <input 
            v-model="newDrawing.id" 
            type="text" 
            placeholder="請輸入圖紙代號 (例如: DR0001)"
            style="text-transform: uppercase;"
          >
        </div>

        <div class="form-group" style="margin-top: 15px;">
          <label>📁 上傳底圖 (.svg 檔案)：</label>
          <div class="file-upload-box">
            <input type="file" accept=".svg" @change="$emit('fileChange', $event)">
          </div>
        </div>

        <button class="submit-btn" @click="$emit('submit')">🚀 確認新增並上傳</button>
        
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// 接收 App.vue 傳遞過來的狀態
defineProps({
  isOpen: Boolean,
  newDrawing: Object
})
// 定義要通知 App.vue 執行的動作
defineEmits(['close', 'fileChange', 'submit'])
</script>

<style scoped>
.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; backdrop-filter: blur(2px); }
.modal { position: fixed; background: white; border-radius: 8px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; display: flex; flex-direction: column; }
.add-main-modal { top: 20vh; left: 50%; transform: translateX(-50%); width: 420px; padding-bottom: 20px; border: 1px solid #ddd; }

.modal-header { background: #2c3e50; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.close-btn { background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.close-btn:hover { background: #c0392b; }

.modal-body { padding: 25px 30px; flex: 1; display: flex; flex-direction: column; gap: 15px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-weight: bold; color: #34495e; font-size: 14px; }
.form-group input[type="text"] { width: 100%; padding: 10px; border: 1px solid #bdc3c7; border-radius: 4px; box-sizing: border-box; font-size: 14px; background: #f9fbfc; transition: border 0.2s; }
.form-group input[type="text"]:focus { border-color: #3498db; outline: none; background: white; }

.file-upload-box { border: 2px dashed #bdc3c7; padding: 15px; border-radius: 6px; text-align: center; background: #fafafa; }
.file-upload-box input[type="file"] { cursor: pointer; }

.submit-btn { background: #27ae60; color: white; border: none; padding: 12px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 15px; margin-top: 10px; transition: 0.2s; box-shadow: 0 2px 5px rgba(39, 174, 96, 0.3); }
.submit-btn:hover { background: #219653; transform: translateY(-1px); }
</style>
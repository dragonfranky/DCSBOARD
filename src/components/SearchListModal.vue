<template>
  <Teleport to="body">
    <div v-if="isOpen" class="overlay"></div>
    <div v-if="isOpen" class="modal search-list-modal">
      <h3 class="modal-title">
        🔍 全域搜尋結果
        <button @click="$emit('close')" class="icon-btn close-btn">✖</button>
      </h3>
      
      <div v-if="isSearching" class="status-msg">
        ⏳ 正在深度掃描所有圖紙，請稍候...
      </div>
      
      <div v-else-if="searchResults.length === 0" class="status-msg error-msg">
        ❌ 找不到包含「{{ searchQuery }}」的任何設備資料。
      </div>
      
      <div v-else class="search-results-container">
        <div 
          v-for="res in searchResults" 
          :key="res.id"
          class="search-result-item"
          @click="$emit('select-result', res)"
        >
          <div class="result-location">
            <span class="badge" :class="res.locationType === 'main' ? 'badge-main' : 'badge-detail'">
              {{ res.locationType === 'main' ? '主圖紙' : '詳細圖面' }}
            </span>
            <strong>{{ res.drawingLabel }}</strong>
          </div>
          <div class="result-detail">
            <template v-if="res.locationType === 'main'">
              找到文字：<span class="highlight-text">{{ res.matchText }}</span>
            </template>
            <template v-else>
              所屬設備視窗：<span class="highlight-text">{{ res.blockId }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// 定義接收的資料 (Props)
defineProps({
  isOpen: Boolean,
  isSearching: Boolean,
  searchResults: Array,
  searchQuery: String
})

// 定義發送給主程式的事件 (Emits)
defineEmits(['close', 'select-result'])
</script>

<style scoped>
.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1001; }
.modal { position: fixed; background: white; border-radius: 8px; z-index: 1002; box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; flex-direction: column; }
.search-list-modal { top: 15vh; left: 50%; transform: translateX(-50%); width: 450px; max-height: 70vh; padding: 20px; }

.modal-title { margin-top: 0; margin-bottom: 15px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
.close-btn { float: right; border: none; font-size: 16px; background: none; cursor: pointer; }
.status-msg { text-align: center; padding: 40px 20px; color: #7f8c8d; font-weight: bold; }
.error-msg { color: #e74c3c; }

.search-results-container { overflow-y: auto; flex: 1; padding-right: 5px; }
.search-result-item { padding: 12px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; background: #fafafa; }
.search-result-item:hover { border-color: #3498db; background: #ebf5fb; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.08); }

.result-location { margin-bottom: 8px; font-size: 15px; color: #2c3e50; display: flex; align-items: center; gap: 10px; }
.result-detail { font-size: 14px; color: #7f8c8d; }

.badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; }
.badge-main { background: #2ecc71; }
.badge-detail { background: #9b59b6; }
.highlight-text { font-weight: bold; color: #e74c3c; background: #fadbd8; padding: 2px 6px; border-radius: 4px; }
</style>
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process'); // ✨ 新增這行：用來呼叫 Windows 系統指令打開瀏覽器
const app = express();
app.use(cors());
app.use(express.json());

// ✨ 關鍵：使用 process.cwd() 讓 EXE 去抓「它所在的外部資料夾」 ✨
const exeDir = process.cwd();
const baseDrawingDir = path.join(exeDir, 'public', 'DRAWING');

// 確保外部資料夾存在
if (!fs.existsSync(baseDrawingDir)) fs.mkdirSync(baseDrawingDir, { recursive: true });

// === 下方是完全相同的 API 邏輯 ===
app.get('/api/drawings', (req, res) => {
  try {
    const items = fs.readdirSync(baseDrawingDir, { withFileTypes: true });
    const folders = items.filter(item => item.isDirectory()).map(item => {
      const id = item.name; let label = id; 
      let category = '未分類'; // ✨ 預設分類
      
      const dataFile = path.join(baseDrawingDir, id, 'data.json');
      if (fs.existsSync(dataFile)) {
        try { 
          const data = JSON.parse(fs.readFileSync(dataFile, 'utf8')); 
          if (data._meta && data._meta.name) label = data._meta.name; 
          if (data._meta && data._meta.category) category = data._meta.category; // ✨ 讀取分類
        } catch(e) {}
      }
      return { value: id, label: label, category: category }; // ✨ 回傳加上 category
    });
    res.json(folders);
  } catch (error) { res.status(500).json([]); }
});

// ✨ 智慧掃描版：取得單一圖紙的 Tag 資料庫與自動掛載 SVG
app.get('/api/data/:drawingId', (req, res) => {
  const drawingId = req.params.drawingId;
  const folderPath = path.join(baseDrawingDir, drawingId);
  const dataFile = path.join(folderPath, 'data.json');
  
  let currentData = {};
  
  // 1. 先讀取已經建檔的資料 (文字、邏輯、標註)
  if (fs.existsSync(dataFile)) {
    try { currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
  }
  
  // 2. 自動掃描實體資料夾，把所有丟進去的 .svg 自動掛載起來！
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    files.forEach(file => {
      // 排除掉主圖紙本身 (例如 DR0003.svg)
      if (file.toLowerCase().endsWith('.svg') && file !== `${drawingId}.svg`) {
        // 去掉附檔名，剩下的就是 TAG 名稱 (例如 PT-001)
        const blockId = file.substring(0, file.lastIndexOf('.'));
        
        // 如果這個 TAG 是全新的，幫它建一個空殼
        if (!currentData[blockId]) {
          currentData[blockId] = {};
        }
        
        // 自動把這張圖檔掛載給它
        currentData[blockId].svgFile = file;
      }
    });
  }
  
  res.json(currentData);
});

app.delete('/api/drawings/:id', (req, res) => {
  const targetDir = path.join(baseDrawingDir, req.params.id);
  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
  res.json({ success: true });
});

// 6. 👉 修改圖紙的顯示名稱與分類
app.put('/api/drawings/:id', (req, res) => {
  const { name, category } = req.body; // ✨ 接收新分類
  const dataFile = path.join(baseDrawingDir, req.params.id, 'data.json');
  
  let currentData = { _meta: { name: name || req.params.id, category: category || '未分類' } };
  if (fs.existsSync(dataFile)) {
    try { 
      currentData = { ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; 
      if (!currentData._meta) currentData._meta = {}; 
      currentData._meta.name = name;
      currentData._meta.category = category || '未分類'; // ✨ 更新分類
    } catch(e) {}
  } else {
    if (!fs.existsSync(path.dirname(dataFile))) fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  }
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
  res.json({ success: true });
});

// ====== 更新版的標註 API (直接覆蓋更新座標) ======
app.put('/api/annotations/:drawingId', (req, res) => {
  const { drawingId } = req.params;
  const dataFile = path.join(baseDrawingDir, drawingId, 'data.json');
  let currentData = {};
  if (fs.existsSync(dataFile)) {
    try { currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
  }
  
  // 直接將前端傳來的最新標註陣列覆蓋存檔
  currentData._annotations = req.body; 
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
  res.json({ success: true });
});
// ===============================================

// ===============================================
// ✨ 更新版的單一設備資料 API (加入標註存檔)
app.put('/api/data/:drawingId/:blockId', (req, res) => {
  const { drawingId, blockId } = req.params; 
  
  // ✨ 1. 在這裡補上 annotations
  const { type, logic, annotations } = req.body;
  
  const dataFile = path.join(baseDrawingDir, drawingId, 'data.json');
  let currentData = {};
  if (fs.existsSync(dataFile)) { try { currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {} } 
  else { if (!fs.existsSync(path.dirname(dataFile))) fs.mkdirSync(path.dirname(dataFile), { recursive: true }); }
  
  if (!currentData[blockId]) currentData[blockId] = {};
  if (type !== undefined) currentData[blockId].type = type;
  if (logic !== undefined) currentData[blockId].logic = logic;
  
  // ✨ 2. 在這裡把標註資料寫進 JSON 物件中
  if (annotations !== undefined) currentData[blockId].annotations = annotations;
  
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
  res.json({ success: true });
});
// ===============================================

app.delete('/api/image/:drawingId/:blockId', (req, res) => {
  const { drawingId, blockId } = req.params;
  const dataFile = path.join(baseDrawingDir, drawingId, 'data.json');
  if (fs.existsSync(dataFile)) {
    try {
      const currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      if (currentData[blockId] && currentData[blockId].svgFile) {
        const imagePath = path.join(baseDrawingDir, drawingId, currentData[blockId].svgFile);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        currentData[blockId].svgFile = null;
        fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
  } else res.json({ success: true });
});

const mainStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destFolder = path.join(baseDrawingDir, req.body.drawingId);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    cb(null, destFolder);
  },
  filename: (req, file, cb) => { cb(null, `${req.body.drawingId}.svg`); }
});
// 3. 👉 新增全新主圖紙：儲存分類
app.post('/api/upload-main', multer({ storage: mainStorage }).single('file'), (req, res) => {
  const { drawingId, drawingName, category } = req.body; // ✨ 接收分類
  if (!req.file || !drawingId) return res.status(400).json({ success: false });
  const dataFile = path.join(baseDrawingDir, drawingId, 'data.json');
  
  // ✨ 寫入 metadata 時包含 category
  let currentData = { _meta: { name: drawingName || drawingId, category: category || '未分類' } };
  if (fs.existsSync(dataFile)) { try { currentData = { ...JSON.parse(fs.readFileSync(dataFile, 'utf8')), ...currentData }; } catch(e){} }
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
  res.json({ success: true });
});

const detailStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, path.join(baseDrawingDir, req.body.drawingId)); },
  filename: (req, file, cb) => { const ext = path.extname(file.originalname) || '.svg'; cb(null, `${req.body.blockId}${ext}`); }
});
app.post('/api/upload', multer({ storage: detailStorage }).single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  const { drawingId, blockId } = req.body; const filename = req.file.filename;
  const dataFile = path.join(baseDrawingDir, drawingId, 'data.json');
  let currentData = {};
  if (fs.existsSync(dataFile)) { try { currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {} }
  if (!currentData[blockId]) currentData[blockId] = { type: '', logic: '' };
  currentData[blockId].svgFile = filename;
  fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
  res.json({ success: true, filename: filename });
});



// === ✨ 讓 EXE 成為一個完整的網站伺服器 ✨ ===

// 1. 將 /DRAWING 網址直接對應到外部的 public/DRAWING 資料夾 (讓您可以隨時抽換檔案)
app.use('/DRAWING', express.static(baseDrawingDir));

// 2. 將網站畫面指向我們剛剛編譯出來的 dist 資料夾
app.use(express.static(path.join(exeDir, 'dist')));

// ✨ 將 Port 設為 0，作業系統就會自動分配一個完全沒人用的隨機 Port
const server = app.listen(0, () => {
  const assignedPort = server.address().port; // 取得系統剛剛分配的 Port
  const localUrl = `http://localhost:${assignedPort}`;

  console.log(`\n==============================================`);
  console.log(`✅ 系統伺服器啟動成功！`);
  console.log(`👉 作業系統已自動分配獨立 Port: ${assignedPort}`);
  console.log(`👉 請不要關閉此黑畫面，正在為您自動開啟瀏覽器...`);
  console.log(`   如果您不小心關閉網頁，可手動輸入此網址：`);
  console.log(`   ${localUrl}`);
  console.log(`==============================================\n`);

  // ✨ 使用系統指令 (start) 自動幫您打開 Windows 預設瀏覽器並前往該網址
  exec(`start ${localUrl}`, (err) => {
    if (err) {
      console.log('⚠️ 自動開啟瀏覽器失敗，請手動複製上方網址貼上。');
    }
  });
});
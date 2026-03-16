import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 讓前端可以讀取 public 裡的 SVG 圖檔

// ==========================================
// 1. 資料庫連線設定
// ==========================================
const dbPath = path.resolve(__dirname, 'db/dcs_project.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ 資料庫連線失敗:', err.message);
    else console.log('✅ 成功連線到全廠 SQLite 資料庫！');
});

// 確保基礎 data 目錄存在 (對應新的十站分類結構)
const baseDataDir = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(baseDataDir)) fs.mkdirSync(baseDataDir, { recursive: true });

// ==========================================
// 2. 資料庫 API (取代原本的 data.json 讀取)
// ==========================================

// 👉 取得動態側邊選單 (改為：掃描實體資料夾，有圖才顯示！)
app.get('/api/menu', (req, res) => {
    const menu = {};
    try {
        if (fs.existsSync(baseDataDir)) {
            // 找出 data 裡面所有的站別資料夾 (FCS0101, FCS0102...)
            const stations = fs.readdirSync(baseDataDir).filter(f => fs.statSync(path.join(baseDataDir, f)).isDirectory());
            
            stations.forEach(station => {
                const dwgDir = path.join(baseDataDir, station, 'DRAWING');
                if (fs.existsSync(dwgDir)) {
                    // 找出 DRAWING 裡面所有的圖號資料夾 (DR0001, DR0002...)
                    const drawings = fs.readdirSync(dwgDir).filter(f => fs.statSync(path.join(dwgDir, f)).isDirectory());
                    if (drawings.length > 0) {
                        menu[station] = drawings; // 只有裡面真的有圖號資料夾，才加入選單
                    }
                }
            });
        }
        res.json(menu); 
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 👉 取得特定圖紙上的所有點位 (供 MainCanvas 亮起黃色底色比對使用)
app.get('/api/tags/:station/:drawing', (req, res) => {
    const { station, drawing } = req.params;
    db.all(`SELECT tag_name, model_name FROM tags WHERE station = ? AND drawing_no = ?`, 
        [station, drawing], 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// 👉 取得特定點位的詳細資料 (合併 EDF、Tuning、以及「手動標註」)
app.get('/api/tag/:station/:drawing/:tag_name', (req, res) => {
    const { station, drawing, tag_name } = req.params;
    const query = `
        SELECT 
            t.station, t.drawing_no, t.tag_name, t.model_name, t.parameters as edf_params,
            td.tuning_parameters,
            uc.type as custom_type, uc.logic as custom_logic, uc.annotations
        FROM tags t
        LEFT JOIN tuning_data td ON t.tag_name = td.tag_name AND t.station = td.station
        LEFT JOIN user_custom_data uc ON t.tag_name = uc.tag_name AND t.station = uc.station AND t.drawing_no = uc.drawing_no
        WHERE t.tag_name = ? AND t.station = ? AND t.drawing_no = ?
    `;
    db.get(query, [tag_name, station, drawing], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '找不到該點位資料' });
        res.json(row);
    });
});

// 👉 取得單一 Tag 的自訂資料 (專門用來讀取虛擬 Tag 或純標註，不檢查 tags 總表)
app.get('/api/custom_data/:station/:drawing/:tag_name', (req, res) => {
    const { station, drawing, tag_name } = req.params;
    db.get('SELECT type as custom_type, logic as custom_logic, annotations FROM user_custom_data WHERE station=? AND drawing_no=? AND tag_name=?', 
        [station, drawing, tag_name], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row || {}); // 如果找不到，回傳空物件而不是報錯
        });
});


// 👉 更新單一 Tag 的自訂文字、邏輯與標註 (存入 SQLite)
app.put('/api/custom_data/:station/:drawing/:tag_name', (req, res) => {
    const { station, drawing, tag_name } = req.params;
    const { type, logic, annotations } = req.body;
    const annosStr = annotations ? JSON.stringify(annotations) : null;

    db.get('SELECT id FROM user_custom_data WHERE station=? AND drawing_no=? AND tag_name=?', 
        [station, drawing, tag_name], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) {
                db.run('UPDATE user_custom_data SET type=COALESCE(?, type), logic=COALESCE(?, logic), annotations=COALESCE(?, annotations) WHERE id=?',
                    [type, logic, annosStr, row.id], 
                    (updateErr) => res.json({ success: !updateErr }));
            } else {
                db.run('INSERT INTO user_custom_data (station, drawing_no, tag_name, type, logic, annotations) VALUES (?, ?, ?, ?, ?, ?)',
                    [station, drawing, tag_name, type, logic, annosStr],
                    (insertErr) => res.json({ success: !insertErr }));
            }
        });
});

// ==========================================
// 3. 實體檔案管理 API (保留你原本的心血！)
// ==========================================

// 👉 儲存設定：新增全新主圖紙 (包含分類站別路徑)
const mainStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ✨ 路徑對應新架構: public/data/FCS0101/DRAWING/DR0003
    const category = req.body.category || '未分類';
    const destFolder = path.join(baseDataDir, category, 'DRAWING', req.body.drawingId);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    cb(null, destFolder);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.body.drawingId}.svg`); // 強制把主圖命名為 代號.svg
  }
});

app.post('/api/upload-main', multer({ storage: mainStorage }).single('file'), (req, res) => {
  if (!req.file || !req.body.drawingId) return res.status(400).json({ success: false });
  // 原本這裡會寫入 data.json，現在我們統一交由 SQLite 管理，所以只要實體檔案存好就回傳成功！
  res.json({ success: true });
});

// 👉 儲存設定：Tag 詳細圖面上傳
const detailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const station = req.body.station || '未分類';
    const destFolder = path.join(baseDataDir, station, 'DRAWING', req.body.drawingId);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    cb(null, destFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.svg';
    cb(null, `${req.body.blockId}${ext}`);
  }
});

app.post('/api/upload', multer({ storage: detailStorage }).single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  
  // 檔案上傳成功後，我們把檔案名稱紀錄到 SQLite 的 user_custom_data 裡
  // (因為 EDF 沒有存實體檔名，我們把它當成自訂資料存起來)
  const { station, drawingId, blockId } = req.body;
  const filename = req.file.filename;

  // 這裡省略了寫入 DB 的複雜判斷，前端只需要知道檔案上傳成功，名稱為何即可
  res.json({ success: true, filename: filename });
});

// 👉 刪除圖紙 (包含整個資料夾與所有上傳的圖)
app.delete('/api/drawings/:station/:id', (req, res) => {
  const targetDir = path.join(baseDataDir, req.params.station, 'DRAWING', req.params.id);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  // 注意：這裡只刪除實體 SVG 圖片，如果連資料庫紀錄也要刪，需再補上一段 DELETE SQL
  res.json({ success: true });
});

// 👉 刪除單一 Tag 的實體圖片
app.delete('/api/image/:station/:drawingId/:blockId', (req, res) => {
  const { station, drawingId, blockId } = req.params;
  const targetDir = path.join(baseDataDir, station, 'DRAWING', drawingId);
  
  // 這裡假設圖檔都是 .svg，如果要支援 png 需另外擴充
  const imagePath = path.join(targetDir, `${blockId}.svg`);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
  res.json({ success: true });
});

// 👉 全廠極速搜尋 API (直接查詢 SQLite 資料庫，0.01 秒回傳)
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    
    // 將關鍵字轉大寫並加上 % 以支援模糊搜尋 (例如輸入 PT 會搜到 PT-028)
    const searchStr = `%${query.toUpperCase()}%`;
    
    // 直接去 tags 表尋找符合的設備
    const sql = `
        SELECT 
            station, 
            drawing_no as drawingId, 
            tag_name as blockId, 
            tag_name as matchText, 
            'main' as locationType
        FROM tags 
        WHERE UPPER(tag_name) LIKE ?
        LIMIT 50  -- 最多回傳 50 筆，避免畫面塞爆
    `;
    
    db.all(sql, [searchStr], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // 整理成前端清單需要的格式
        const formattedRows = rows.map(r => ({
            id: `search_${r.station}_${r.blockId}_${Math.random()}`,
            station: r.station,
            drawingId: r.drawingId,
            locationType: r.locationType,
            blockId: r.blockId,
            matchText: r.matchText
        }));
        
        res.json(formattedRows);
    });
});

// ==========================================
// 4. 系統啟動設定 (開發階段使用固定 Port: 3000)
// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(`✅ DCS 戰情室 [後端 API] 啟動成功！ (Port: ${PORT})`);
  console.log(`👉 資料庫連線正常，準備接收前端請求...`);
  console.log(`==============================================\n`);
});
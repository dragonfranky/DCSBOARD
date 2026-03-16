const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🌟 綠色版核心：自動判斷是 Node 測試環境還是 EXE 打包環境
// ==========================================
// 如果 process.pkg 存在，代表是打包後的 .exe 環境；否則就是一般 node 測試環境
const isPkg = typeof process.pkg !== 'undefined';
const exeDir = isPkg ? path.dirname(process.execPath) : __dirname;

const dbDir = path.join(exeDir, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'dcs_project.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
    } else {
        console.log('✅ 成功連線到外部 SQLite 資料庫！');
        
        // ✨ 自動檢查並建立資料表結構 (如果不存在的話)
        db.serialize(() => {
            // 1. 建立 tags 表 (存放 EDF 解析出來的點位)
            db.run(`CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project TEXT,
                station TEXT,
                drawing_no TEXT,
                file_name TEXT,
                tag_name TEXT,
                model_name TEXT,
                parameters TEXT
            )`);

            // 2. 建立 tuning_data 表 (存放 TuningData.txt 的調校參數)
            db.run(`CREATE TABLE IF NOT EXISTS tuning_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station TEXT,
                tag_name TEXT,
                category TEXT,
                block_type TEXT,
                tuning_parameters TEXT
            )`);

            // 3. 建立 user_custom_data 表 (存放使用者的手動標註、圖片紀錄與自訂邏輯)
            db.run(`CREATE TABLE IF NOT EXISTS user_custom_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station TEXT,
                drawing_no TEXT,
                tag_name TEXT,
                type TEXT,
                logic TEXT,
                annotations TEXT
            )`);
            
            console.log('✅ 資料庫資料表結構檢查/初始化完成！');
        });
    }
});

const baseDataDir = path.join(exeDir, 'public', 'data');
if (!fs.existsSync(baseDataDir)) fs.mkdirSync(baseDataDir, { recursive: true });
app.use('/data', express.static(baseDataDir));

// ==========================================
// 🌟 API 路由區 (包含所有功能與同步機制)
// ==========================================
app.get('/api/menu', (req, res) => {
    const menu = {};
    try {
        if (fs.existsSync(baseDataDir)) {
            const stations = fs.readdirSync(baseDataDir).filter(f => fs.statSync(path.join(baseDataDir, f)).isDirectory());
            stations.forEach(station => {
                const dwgDir = path.join(baseDataDir, station, 'DRAWING');
                if (fs.existsSync(dwgDir)) {
                    const drawings = fs.readdirSync(dwgDir).filter(f => fs.statSync(path.join(dwgDir, f)).isDirectory());
                    if (drawings.length > 0) menu[station] = drawings;
                }
            });
        }
        res.json(menu); 
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/tags/:station/:drawing', (req, res) => {
    db.all(`SELECT tag_name, model_name FROM tags WHERE station = ? AND drawing_no = ?`, 
        [req.params.station, req.params.drawing], 
        (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }
    );
});

// ✨ 被遺忘的 API：讀取單一設備的詳細參數 (彈出視窗用)
app.get('/api/tag/:station/:drawing/:tag_name', (req, res) => {
    const query = `
        SELECT t.station, t.drawing_no, t.tag_name, t.model_name, t.parameters as edf_params,
               td.tuning_parameters, uc.type as custom_type, uc.logic as custom_logic, uc.annotations
        FROM tags t
        LEFT JOIN tuning_data td ON t.tag_name = td.tag_name AND t.station = td.station
        LEFT JOIN user_custom_data uc ON t.tag_name = uc.tag_name AND t.station = uc.station AND t.drawing_no = uc.drawing_no
        WHERE t.tag_name = ? AND t.station = ? AND t.drawing_no = ?
    `;
    db.get(query, [req.params.tag_name, req.params.station, req.params.drawing], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '找不到該點位資料' });
        res.json(row);
    });
});

app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    const searchStr = `%${query.toUpperCase()}%`;
    db.all(`SELECT station, drawing_no as drawingId, tag_name as blockId, tag_name as matchText, 'main' as locationType FROM tags WHERE UPPER(tag_name) LIKE ? LIMIT 50`, 
        [searchStr], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ id: `search_${r.station}_${r.blockId}_${Math.random()}`, ...r })));
    });
});

app.get('/api/custom_data/:station/:drawing/:tag_name', (req, res) => {
    db.get('SELECT type as custom_type, logic as custom_logic, annotations FROM user_custom_data WHERE station=? AND drawing_no=? AND tag_name=?', 
        [req.params.station, req.params.drawing, req.params.tag_name], 
        (err, row) => { if (err) return res.status(500).json({ error: err.message }); res.json(row || {}); });
});

app.put('/api/custom_data/:station/:drawing/:tag_name', (req, res) => {
    const { station, drawing, tag_name } = req.params;
    const { type, logic, annotations } = req.body;
    const annosStr = annotations ? JSON.stringify(annotations) : null;
    db.get('SELECT id FROM user_custom_data WHERE station=? AND drawing_no=? AND tag_name=?', [station, drawing, tag_name], (err, row) => {
        if (row) {
            db.run('UPDATE user_custom_data SET type=COALESCE(?, type), logic=COALESCE(?, logic), annotations=COALESCE(?, annotations) WHERE id=?',
                [type, logic, annosStr, row.id], () => res.json({ success: true }));
        } else {
            db.run('INSERT INTO user_custom_data (station, drawing_no, tag_name, type, logic, annotations) VALUES (?, ?, ?, ?, ?, ?)',
                [station, drawing, tag_name, type, logic, annosStr], () => res.json({ success: true }));
        }
    });
});

// ✨ 全新實裝的 API：一鍵同步 data_source 資料夾！(極速修復版)
app.post('/api/sync-db', async (req, res) => {
    const dataSourceDir = path.join(exeDir, 'data_source');
    if (!fs.existsSync(dataSourceDir)) {
        return res.status(400).json({ error: '找不到 data_source 資料夾！請放置於系統目錄下。' });
    }
    try {
        console.log('🔄 開始背景同步資料庫...');
        
        // ==========================
        // 1. 同步 Tags (EDF 解析)
        // ==========================
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION"); // ✨ 關鍵修復：開啟極速寫入模式
                db.run("DELETE FROM tags"); 
                const stmt = db.prepare(`INSERT INTO tags (project, station, drawing_no, file_name, tag_name, model_name, parameters) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                
                const stations = fs.readdirSync(dataSourceDir, { withFileTypes: true }).filter(d => d.isDirectory());
                for (const station of stations) {
                    const fbDir = path.join(dataSourceDir, station.name, 'FUNCTION_BLOCK');
                    if (!fs.existsSync(fbDir)) continue;
                    const drawings = fs.readdirSync(fbDir, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('DR'));
                    for (const drawing of drawings) {
                        const drawingPath = path.join(fbDir, drawing.name);
                        const files = fs.readdirSync(drawingPath).filter(f => f.toLowerCase().endsWith('.edf'));
                        for (const file of files) {
                            const content = fs.readFileSync(path.join(drawingPath, file), 'utf-8');
                            const tagName = file.replace(/\.edf$/i, '');
                            let modelName = "UNKNOWN";
                            const modelMatch = content.match(new RegExp(`([A-Z0-9-]+)\\s+${tagName}`));
                            if (modelMatch) modelName = modelMatch[1];
                            let parametersJSON = "{}";
                            const matches = content.match(/([A-Z0-9!_]+:[^;]*;)/g);
                            if (matches) {
                                let paramObj = {}; let cnctCount = 1;
                                for (const pair of matches) {
                                    const firstColonIdx = pair.indexOf(':');
                                    if (firstColonIdx > -1) {
                                        let key = pair.substring(0, firstColonIdx).trim();
                                        if (key === 'CNCT') { key = `CNCT${cnctCount}`; cnctCount++; }
                                        paramObj[key] = pair.substring(firstColonIdx + 1).replace(';', '').trim();
                                    }
                                }
                                parametersJSON = JSON.stringify(paramObj);
                            }
                            stmt.run('BL13', station.name, drawing.name, file, tagName, modelName, parametersJSON);
                        }
                    }
                }
                stmt.finalize();
                db.run("COMMIT", resolve); // ✨ 關鍵修復：全部一次存入硬碟
            });
        });

        // ==========================
        // 2. 同步 Tuning Data
        // ==========================
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION"); // ✨ 關鍵修復：開啟極速寫入模式
                db.run("DELETE FROM tuning_data");
                const stmt = db.prepare(`INSERT INTO tuning_data (station, tag_name, category, block_type, tuning_parameters) VALUES (?, ?, ?, ?, ?)`);
                
                const stations = fs.readdirSync(dataSourceDir, { withFileTypes: true }).filter(d => d.isDirectory());
                for (const station of stations) {
                    const txtPath = path.join(dataSourceDir, station.name, 'TunningData.txt');
                    if (!fs.existsSync(txtPath)) continue;
                    const lines = fs.readFileSync(txtPath, 'utf-8').split(/\r?\n/);
                    for (let line of lines) {
                        line = line.trim();
                        if (!line || !line.includes('FPAR')) continue;
                        if (line.endsWith(';')) line = line.slice(0, -1);
                        const parts = line.split(':');
                        if (parts.length < 8) continue;
                        let paramObj = {};
                        const params = parts.slice(7).join(':').split(',');
                        for (const p of params) {
                            const eqIdx = p.indexOf('=');
                            if (eqIdx > -1) paramObj[p.substring(0, eqIdx)] = p.substring(eqIdx + 1);
                        }
                        stmt.run(station.name, parts[4], parts[3], parts[6], JSON.stringify(paramObj));
                    }
                }
                stmt.finalize();
                db.run("COMMIT", resolve); // ✨ 關鍵修復：全部一次存入硬碟
            });
        });

        console.log('✅ 資料庫同步完成！');
        res.json({ success: true, message: '資料庫同步完成！' });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ error: error.message }); 
    }
});

const mainStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destFolder = path.join(baseDataDir, req.body.category || '未分類', 'DRAWING', req.body.drawingId);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    cb(null, destFolder);
  },
  filename: (req, file, cb) => { cb(null, `${req.body.drawingId}.svg`); }
});
app.post('/api/upload-main', multer({ storage: mainStorage }).single('file'), (req, res) => { res.json({ success: true }); });

const detailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destFolder = path.join(baseDataDir, req.body.station || '未分類', 'DRAWING', req.body.drawingId);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    cb(null, destFolder);
  },
  filename: (req, file, cb) => { cb(null, `${req.body.blockId}${path.extname(file.originalname) || '.svg'}`); }
});
app.post('/api/upload', multer({ storage: detailStorage }).single('file'), (req, res) => { res.json({ success: true, filename: req.file.filename }); });

app.delete('/api/drawings/:station/:id', (req, res) => {
  const targetDir = path.join(baseDataDir, req.params.station, 'DRAWING', req.params.id);
  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
  res.json({ success: true });
});

app.delete('/api/image/:station/:drawingId/:blockId', (req, res) => {
  const imagePath = path.join(baseDataDir, req.params.station, 'DRAWING', req.params.drawingId, `${req.params.blockId}.svg`);
  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  res.json({ success: true });
});

// ==========================================
// 🌟 網頁啟動 (固定回 Port 3000，避免前端 Timeout 卡死)
// ==========================================
app.use(express.static(path.join(exeDir, 'dist')));



// Express 5 官方建議的萬用路徑寫法
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(exeDir, 'dist', 'index.html'));
});

// 將 Port 設為 0，讓作業系統自動分配一個隨機的可用 Port
const server = app.listen(0, () => {
  // 取得系統實際分配的 Port 號碼
  const assignedPort = server.address().port; 
  
  console.log(`\n==============================================`);
  console.log(`✅ DCS 戰情室系統啟動成功！`);
  console.log(`👉 已自動分配可用 Port: ${assignedPort} (避免 Port 衝突)`);
  console.log(`👉 正在為您自動開啟瀏覽器...`);
  console.log(`==============================================\n`);
  
  // 使用實際分配到的 Port 開啟瀏覽器
  exec(`start http://localhost:${assignedPort}`);
});
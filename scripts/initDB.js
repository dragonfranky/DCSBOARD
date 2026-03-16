const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 1. 設定資料庫檔案的存放路徑
const dbPath = path.resolve(__dirname, '../db/dcs_project.db');

// 2. 建立並連線到 SQLite 資料庫
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 資料庫連線失敗:', err.message);
    } else {
        console.log('✅ 成功連線到 SQLite 資料庫！');
    }
});

// 3. 建立所有的資料表
db.serialize(() => {
    // 【第一張表】EDF 靜態資料表
    db.run(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT,          
            station TEXT,          
            drawing_no TEXT,       
            file_name TEXT,        
            tag_name TEXT,         
            model_name TEXT,       
            parameters TEXT,       
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 【第二張表】Tuning Data 動態資料表
    db.run(`
        CREATE TABLE IF NOT EXISTS tuning_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station TEXT,          
            tag_name TEXT,         
            category TEXT,         
            block_type TEXT,       
            tuning_parameters TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 🌟 【第三張表】今天新增的：手動標註與邏輯資料表
    db.run(`
        CREATE TABLE IF NOT EXISTS user_custom_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station TEXT,          -- 站別
            drawing_no TEXT,       -- 圖號
            tag_name TEXT,         -- 點名
            type TEXT,             -- 自訂類型
            logic TEXT,            -- 自訂邏輯
            annotations TEXT,      -- 畫在畫面上的標註 (轉成 JSON 字串)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ 建立資料表失敗:', err.message);
        } else {
            console.log('✅ 成功建立/更新所有資料表架構 (包含手動標註表)！');
        }
    });
});

// 4. 關閉連線
db.close();
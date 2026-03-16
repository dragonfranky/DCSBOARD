const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '../db/dcs_project.db');
const db = new sqlite3.Database(dbPath);
const dataDir = path.resolve(__dirname, '../data');

console.log('🔍 開始掃描全廠 Tuning Data...');

db.serialize(() => {
    // 每次匯入前清空舊資料，避免重複
    db.run("DELETE FROM tuning_data");
    db.run("BEGIN TRANSACTION");
    
    const stmt = db.prepare(`
        INSERT INTO tuning_data (station, tag_name, category, block_type, tuning_parameters)
        VALUES (?, ?, ?, ?, ?)
    `);

    let fileCount = 0;
    let tagCount = 0;

    // 尋找各站別資料夾
    const stations = fs.readdirSync(dataDir, { withFileTypes: true })
                       .filter(dirent => dirent.isDirectory());

    for (const station of stations) {
        const stationName = station.name;
        const txtPath = path.join(dataDir, stationName, 'TunningData.txt');

        if (!fs.existsSync(txtPath)) {
            console.log(`⚠️ 站別 ${stationName} 找不到 TunningData.txt，已略過。`);
            continue;
        }

        console.log(`⚙️ 正在處理 ${stationName} 的 Tuning Data...`);
        fileCount++;
        
        // 讀取並解析 TXT 內容
        const lines = fs.readFileSync(txtPath, 'utf-8').split(/\r?\n/);
        for (let line of lines) {
            line = line.trim();
            if (!line || !line.includes('FPAR')) continue;
            if (line.endsWith(';')) line = line.slice(0, -1);
            
            // 完美移植你的 Python 邏輯：依照冒號切割
            const parts = line.split(':');
            if (parts.length < 8) continue;
            
            const category = parts[3];
            const tagName = parts[4];
            const blockType = parts[6];
            // 把參數段落合併回來 (防呆機制：避免參數內容本身含有冒號被誤切)
            const paramStr = parts.slice(7).join(':'); 
            
            let paramObj = {};
            const params = paramStr.split(',');
            for (const p of params) {
                const eqIdx = p.indexOf('=');
                if (eqIdx > -1) {
                    paramObj[p.substring(0, eqIdx)] = p.substring(eqIdx + 1);
                }
            }
            
            const paramsJSON = JSON.stringify(paramObj);
            stmt.run(stationName, tagName, category, blockType, paramsJSON);
            tagCount++;
        }
    }

    stmt.finalize();
    db.run("COMMIT", () => {
        console.log(`\n✅ Tuning Data 解析大功告成！共讀取了 ${fileCount} 個站別檔案，成功寫入 ${tagCount} 筆調校參數。`);
        db.close();
    });
});
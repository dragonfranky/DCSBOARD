import fs from 'fs';
import path from 'path';
import sqlite3Pkg from 'sqlite3';
import { fileURLToPath } from 'url';

const sqlite3 = sqlite3Pkg.verbose();

// 🌟 解決 ES Module 沒有 __dirname 的問題
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 連線到資料庫
const dbPath = path.resolve(__dirname, '../db/dcs_project.db');
const db = new sqlite3.Database(dbPath);

// 2. 設定起點資料夾 (這次我們指向 data 資料夾)
const dataDir = path.resolve(__dirname, '../data_source');

console.log('🔍 開始掃描全廠資料夾: ' + dataDir);

if (!fs.existsSync(dataDir)) {
    console.error('❌ 找不到路徑，請確認 data 資料夾是否存在！');
    process.exit(1);
}

db.serialize(() => {
    // 每次匯入前，先清空舊資料避免重複寫入 (如果你想保留舊資料可以把這行註解掉)
    db.run("DELETE FROM tags");

    db.run("BEGIN TRANSACTION");
    
    const stmt = db.prepare(`
        INSERT INTO tags (project, station, drawing_no, file_name, tag_name, model_name, parameters)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let fileCount = 0;

    // 3. 第一層迴圈：讀取 data 下的「站別」資料夾 (例如 FCS0101, FCS0102)
    const stations = fs.readdirSync(dataDir, { withFileTypes: true })
                       .filter(dirent => dirent.isDirectory());

    for (const station of stations) {
        const stationName = station.name; // 例如 FCS0101
        // 拼湊出 FUNCTION_BLOCK 的路徑
        const fbDir = path.join(dataDir, stationName, 'FUNCTION_BLOCK');

        // 檢查這個站裡面有沒有 FUNCTION_BLOCK 資料夾，沒有就跳過
        if (!fs.existsSync(fbDir)) {
            console.log(`⚠️ 站別 ${stationName} 找不到 FUNCTION_BLOCK 資料夾，已略過。`);
            continue;
        }

        // 4. 第二層迴圈：讀取 DRxxxx 資料夾
        const drawings = fs.readdirSync(fbDir, { withFileTypes: true })
                           .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('DR'));

        for (const drawing of drawings) {
            const drawingName = drawing.name; 
            const drawingPath = path.join(fbDir, drawingName);

            // 5. 第三層迴圈：讀取 .edf 檔案
            const files = fs.readdirSync(drawingPath)
                            .filter(file => file.toLowerCase().endsWith('.edf'));

            for (const file of files) {
                const filePath = path.join(drawingPath, file);
                const content = fs.readFileSync(filePath, 'utf-8');

                // --- 解析資料 ---
                const tagName = file.replace(/\.edf$/i, '');

                let modelName = "UNKNOWN";
                const modelRegex = new RegExp(`([A-Z0-9-]+)\\s+${tagName}`);
                const modelMatch = content.match(modelRegex);
                if (modelMatch) {
                    modelName = modelMatch[1];
                }

                // --- 解析 Parameters 參數 ---
                let parametersJSON = "{}";
                
                // 🌟 修正版正則表達式：使用 /g 全域搜尋，抓取所有 key:value; 組合，無視空白中斷！
                const paramRegex = /([A-Z0-9!_]+:[^;]*;)/g; 
                const matches = content.match(paramRegex);

                if (matches) {
                    let paramObj = {};
                    let cnctCount = 1; // 🌟 用來給重複的連線編號 (CNCT1, CNCT2...)
                    
                    for (const pair of matches) {
                        const firstColonIdx = pair.indexOf(':');
                        if (firstColonIdx > -1) {
                            let key = pair.substring(0, firstColonIdx).trim();
                            // 拔除結尾的分號
                            let value = pair.substring(firstColonIdx + 1).replace(';', '').trim();
                            
                            // 🌟 解決 CNCT 重複覆蓋的問題：將 Key 轉為 CNCT1, CNCT2...
                            if (key === 'CNCT') {
                                key = `CNCT${cnctCount}`;
                                cnctCount++;
                            }
                            
                            paramObj[key] = value; 
                        }
                    }
                    parametersJSON = JSON.stringify(paramObj);
                }

                // 將站名 (stationName) 動態寫入資料庫！
                stmt.run('BL13', stationName, drawingName, file, tagName, modelName, parametersJSON);
                fileCount++;
            }
        }
        console.log(`✔️ ${stationName} 解析完成！`);
    }

    stmt.finalize();
    db.run("COMMIT", () => {
        console.log(`\n✅ 全廠解析大功告成！共處理了 ${fileCount} 個 EDF 檔案，已全數寫入單一資料庫。`);
        db.close();
    });
});
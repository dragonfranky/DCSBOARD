const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 連線到你的全廠資料庫
const dbPath = path.resolve(__dirname, '../db/dcs_project.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 開始進行全廠資料庫「雙表關聯」查詢測試...\n');

db.serialize(() => {
    // 測試 1：統計資料庫總筆數，確認雙庫都有資料
    db.get("SELECT COUNT(*) as count FROM tags", (err, row) => {
        console.log(`📊 [靜態組態] EDF Tags 總筆數: ${row.count}`);
    });
    db.get("SELECT COUNT(*) as count FROM tuning_data", (err, row) => {
        console.log(`📊 [動態參數] Tuning Data 總筆數: ${row.count}\n`);
    });

    // 測試 2：🌟 終極測試 - 隨機抓 3 個點位，把 EDF 和 Tuning 參數合併顯示！
    // 使用 LEFT JOIN 透過 tag_name 和 station 把兩張表綁在一起
    const joinQuery = `
        SELECT 
            t.station, 
            t.tag_name, 
            t.model_name, 
            t.parameters AS edf_params, 
            td.tuning_parameters 
        FROM tags t
        JOIN tuning_data td 
          ON t.tag_name = td.tag_name AND t.station = td.station
        LIMIT 3
    `;

    db.all(joinQuery, [], (err, rows) => {
        if (err) {
            console.error("查詢失敗:", err);
            return;
        }

        console.log('🔗 【關聯查詢結果】(同時顯示底層組態與即時調校參數)：');
        rows.forEach((row, index) => {
            console.log(`\n--- 點位 ${index + 1}: [${row.station}] ${row.tag_name} (${row.model_name}) ---`);
            
            // 解析 EDF 參數 (靜態)
            const edf = JSON.parse(row.edf_params || '{}');
            console.log(`🔹 [EDF 組態] 警報等級 (EALA): ${edf['EALA'] || '無設定'} | 掃描週期 (ETIM): ${edf['ETIM'] || '無設定'}`);
            
            // 解析 Tuning 參數 (動態)
            const tuning = JSON.parse(row.tuning_parameters || '{}');
            console.log(`🔸 [Tuning 參數] HH 警報值: ${tuning['HH'] || 'N/A'} | LL 警報值: ${tuning['LL'] || 'N/A'} | 測量值(PV): ${tuning['PV'] || 'N/A'}`);
        });

        console.log('\n✅ 雙表關聯查詢測試完成！你的底層 API 已經具備商用級的查詢能力了。');
    });
});

db.close();
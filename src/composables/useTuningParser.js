// src/composables/useTuningParser.js

const parseJSON = (str) => {
  try {
    if (!str) return {};
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch { return {}; }
};

const formatTuningValue = (key, val) => {
  if (val === null || val === undefined) return '';
  const strVal = String(val).trim();

  // 翻譯系統參數
  if (['MODE', 'OMOD', 'CMOD'].includes(key) && strVal === '4194304') return 'AUT (AUT)';
  if (key === 'ALRM' && strVal === '8388608') return 'NR';
  
  return strVal;
};

export function useTuningParser() {
  const getSortedTuningParams = (paramsStr) => {
    const paramsObj = parseJSON(paramsStr);
    if (!paramsObj || Object.keys(paramsObj).length === 0) return [];

    let keys = Object.keys(paramsObj);
    const rows = [];

    const addRow = (k1, k2) => {
      let left = null;
      let right = null;
      let hasData = false;

      if (k1 && keys.includes(k1)) {
        left = { key: k1, val: formatTuningValue(k1, paramsObj[k1]) };
        keys = keys.filter(k => k !== k1);
        hasData = true;
      }
      if (k2 && keys.includes(k2)) {
        right = { key: k2, val: formatTuningValue(k2, paramsObj[k2]) };
        keys = keys.filter(k => k !== k2);
        hasData = true;
      }

      if (hasData) {
        rows.push({ left, right });
      }
    };

    // 🌟 1. 核心控制與 PID 參數
    addRow('MODE', 'ALRM');   
    addRow('P', 'I');         
    addRow('D', null);        
    addRow('PH', 'PL');       
    addRow('SH', 'SL');       
    addRow('MH', 'ML');       
    addRow('VL', 'PR');       
    addRow('CK', null);
    addRow('SW', null);       

    // 🌟 2. 智慧化配對：折線圖 X 與 Y (上限擴充至 99)
    for (let i = 1; i <= 99; i++) {
      const pad = i.toString().padStart(2, '0');
      addRow(`X${pad}`, `Y${pad}`);
    }

    // 🌟 3. 智慧化配對：偏差警報 DH 與 DL (上限擴充至 99)
    for (let i = 1; i <= 99; i++) {
      const pad = i.toString().padStart(2, '0');
      addRow(`DH${pad}`, `DL${pad}`);
    }

    // 🌟 4. 智慧化配對：步序/時間 PT 與 ST (上限擴充至 99)
    for (let i = 1; i <= 99; i++) {
      const pad = i.toString().padStart(2, '0');
      addRow(`PT${pad}`, `ST${pad}`);
    }

    // 🌟 5. 連續單參數配對：DT01 與 DT02... (上限擴充至 99)
    for (let i = 1; i <= 99; i += 2) {
      const pad1 = i.toString().padStart(2, '0');
      const pad2 = (i + 1).toString().padStart(2, '0');
      if (keys.includes(`DT${pad1}`) || keys.includes(`DT${pad2}`)) {
        addRow(`DT${pad1}`, `DT${pad2}`);
      }
    }

    // ==========================================
    // 🌟 隔離作業：將「系統底層參數」與「一般參數」分開
    // ==========================================
    
    // 找出 YOKOGAWA 專用的系統底層陣列
    const systemKeys = keys.filter(k => 
      ['AF', 'AFLS', 'CMOD', 'OMOD', 'ISS', 'OPMK', 'SAID', 'UAID', 'AOFS', 'MRGN', 'MRGE'].includes(k) || 
      k.startsWith('CIS[')
    );
    
    // 剩下沒被配對到的，就是一般參數
    const normalKeys = keys.filter(k => !systemKeys.includes(k));

    // 🌟 6. 渲染一般參數 (依字母順序，兩兩一行)
    normalKeys.sort();
    for (let i = 0; i < normalKeys.length; i += 2) {
      addRow(normalKeys[i], normalKeys[i + 1] || null);
    }

    // 🌟 7. 渲染系統底層參數 (強制放在面板最底部！)
    systemKeys.sort();
    for (let i = 0; i < systemKeys.length; i += 2) {
      addRow(systemKeys[i], systemKeys[i + 1] || null);
    }

    return rows;
  };

  return { getSortedTuningParams };
}
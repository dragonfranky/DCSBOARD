// src/composables/useEdfParser.js

const parseJSON = (str) => {
  try {
    if (!str) return {};
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch { return {}; }
};

// 🌟 1. 完整版字典 (加入 ST16 專用的 TGMK 與 CONS)
const edfDictionary = {
  'TGMK': 'Tag Mark', 'CONS': 'Constant',
  'ETCM': 'Tag Comment', 'ESCA': 'Scan Period', 'EINP': 'Input Signal Conversion',
  'DBLA': 'Double Authentication', 'MSBP': 'Status Change Message Bypass', 
  'HLPM': 'Help', 'SREV': 'Scale Reverse Display', 'DVNO': 'Scale - division',
  'ESCL': 'Process Variable Range', 'EUNT': 'Engineering Unit Symbol', 'OVPV': 'PV Overshoot',
  'EALA': 'Alarm Level', 'INOP': 'Input Open Alarm', 'ILCN': 'Bad Connection Alarm', 'CABN': 'Calculated input value error detected',
  'OTRK': 'Output Value Tracking', 'OUTL': 'Output Signal Conversion', 'SUOC': 'Auxiliary Output', 
  'CCOU': 'Output Type', 'SOAC': 'Positional Output Action',
  'TMNC': 'Start Timing', 'SQC!': 'Sampling Interval', 'PIR!': 'Proportional Integral', 
  'SSI!': 'System Status Input', 'SSO!': 'System Status Output',
  'FLTR': 'Input Signal Filtering', 'PVRL': 'PV Limit', 'SIOP': 'Inhibit IOP Reactions',
  'HHLL': 'PV High-High/Low-Low Limit Alarm (ALARM_SUM)', 'INHL': 'PV High/Low Limit Alarm (ALARM_SUM)',
  'HHLH': 'Hysteresis', 'INVC': 'Input Velocity Limit Alarm', 'SUOP': 'Output data',
  'UPPG': 'Upper Equipment Name', 'UPPL': 'Upper Window', 'SCCP': 'Scan coefficient', 
  'IVHS': 'Number of Samples', 'HHDS': 'Delay for HH alarm detection [sec]',
  'HIDS': 'Delay for HI alarm detection [sec]', 'LODS': 'Delay for LO alarm detection [sec]',
  'LLDS': 'Delay for LL alarm detection [sec]', 'BADS': 'Delay for Bad Connection alarm detection [sec]',
  'ELIM': 'Alarm Limit', 'ESUM': 'Alarm Sum', 'ETIM': 'Alarm Timer', 'SMET': 'Status Change Message'
};

// 🌟 2. 群組內的權重排序
const PDF_ORDER = [
  'ETCM', 'ESCA', 'SCCP', 'EINP',                           
  'TGMK', 'DBLA', 'MSBP', 'UPPG', 'UPPL', 'HLPM', 'SREV', 'DVNO',           
  'ESCL', 'EUNT', 'FLTR', 'OVPV', 'PVRL', 'SIOP',                           
  'EALA', 'INOP', 'HHLL', 'INHL', 'HHLH', 'HHDS', 'HIDS', 'LODS', 'LLDS', 'BADS', 'INVC', 'IVHS', 'ILCN', 'CABN', 'ELIM', 'ESUM', 'ETIM', 'SMET',
  'OTRK', 'OUTL', 'SUOC', 'CCOU', 'SOAC',           
  'CONS', 'TMNC', 'SQC!', 'PIR!', 'SSI!', 'SSO!'            
];

// 🌟 3. 分類引擎
const getGroupName = (cleanKey) => {
  if (cleanKey === 'CNCT') return 'Connection';
  if (['ETCM', 'ESCA', 'SCCP', 'EINP'].includes(cleanKey)) return 'Basic';
  if (['TGMK', 'DBLA', 'MSBP', 'UPPG', 'UPPL', 'HLPM', 'SREV', 'DVNO'].includes(cleanKey)) return 'Tag';
  if (['ESCL', 'EUNT', 'FLTR', 'OVPV', 'PVRL', 'SIOP'].includes(cleanKey)) return 'Input';
  if (['EALA', 'INOP', 'HHLL', 'INHL', 'HHLH', 'HHDS', 'HIDS', 'LODS', 'LLDS', 'BADS', 'INVC', 'IVHS', 'ILCN', 'CABN', 'ELIM', 'ESUM', 'ETIM', 'SMET'].includes(cleanKey)) return 'Alarm';
  if (['OTRK', 'OUTL', 'SUOC', 'CCOU', 'SOAC'].includes(cleanKey)) return 'Output';
  
  return 'Others'; 
};

const formatEdfValue = (key, val) => {
  if (!val) return '';
  const strVal = String(val).trim();

  if (key === 'ESCL') {
    const parts = strVal.split(':');
    if (parts.length >= 2) return `High limit value ${parts[0]}\nLow limit value ${parts[1]}`;
  }
  if (key === 'SCCP') {
    const parts = strVal.split(':');
    if (parts.length >= 2) return `${parts[0]}\nScan phase ${parts[1]}`;
  }
  if (key === 'IVHS') {
    const parts = strVal.split(':');
    if (parts.length >= 3) return `${parts[0]}\nSampling Interval ${parts[1]}\nHysteresis ${parts[2]}`;
  }
  if (['HHDS', 'HIDS', 'LODS', 'LLDS', 'BADS'].includes(key)) {
    const parts = strVal.split(':');
    if (parts.length >= 2) return `${parts[0]}\nDelay for detection of recovery from alarm [sec] ${parts[1]}`;
  }

  const commonMap = {
    'YES': 'Yes', 'NO': 'No', 'AUTO': 'Automatic Determination', 'LINEAR': 'No',
    'POS': 'Positional Output Action', 'POSITION': 'Positional Output Action',
    'HL': 'Both', 'S': 'Basic Scan', 'T': 'Periodic Execution', 'CPV': 'PV', 
    '1': '1', '2': 'Medium', 'HOLDINGPV': 'Holding PV', 'INVALID': 'Invalid',
    'BOTH': 'Both', 'PV': 'PV', 'HHLL': 'Alarm on High-High Limit or Low-Low Limit',
    'GENERAL': 'General'
  };

  return commonMap[strVal.toUpperCase()] || strVal;
};

export function useEdfParser() {
  const getSortedEdfParams = (paramsStr) => {
    const paramsObj = parseJSON(paramsStr);
    if (!paramsObj || Object.keys(paramsObj).length === 0) return [];

    const grouped = {
      'Basic': [], 'Tag': [], 'Input': [], 'Alarm': [], 
      'Output': [], 'Connection': [], 'Others': []
    };

    Object.keys(paramsObj).forEach(key => {
       const cleanKey = key.replace(/[0-9]+$/, '');
       
       // ✨ 終極殺手鐧：嚴格過濾！
       // 如果 PDF 字典裡沒有定義這個代碼，且它也不是連線參數，我們就直接拋棄它，不讓它污染畫面！
       if (!edfDictionary[cleanKey] && cleanKey !== 'CNCT') return;

       let label = edfDictionary[cleanKey] || key;
       let val = paramsObj[key];

       if (cleanKey === 'CNCT') {
          const parts = String(val).split(':');
          if (parts.length >= 2) {
             const type = parts[0]; 
             const target = parts[1];
             if (type === 'IN') label = 'Measurement Input(IN)';
             else if (type === 'Q01' || type === 'OUT') label = 'Measured Value Output(OUT)';
             else if (type === 'SUB') label = 'Auxiliary Output(SUB)';
             else label = `Connection (${type})`;
             val = target; 
          }
       }

       const groupName = getGroupName(cleanKey);
       grouped[groupName].push({
         cleanKey: cleanKey, rawKey: key, label: label, value: formatEdfValue(cleanKey, val)
       });
    });

    const result = [];
    const groupOrder = ['Basic', 'Tag', 'Input', 'Alarm', 'Output', 'Connection', 'Others'];

    groupOrder.forEach(gName => {
       if (grouped[gName].length > 0) {
           grouped[gName].sort((a, b) => {
               const idxA = PDF_ORDER.indexOf(a.cleanKey);
               const idxB = PDF_ORDER.indexOf(b.cleanKey);
               if (idxA !== -1 && idxB !== -1) return idxA - idxB;
               if (idxA !== -1) return -1;
               if (idxB !== -1) return 1;
               return a.rawKey.localeCompare(b.rawKey);
           });

           result.push({ isHeader: true, label: gName });
           grouped[gName].forEach(item => {
               result.push({ isHeader: false, rawKey: item.rawKey, label: item.label, value: item.value });
           });
       }
    });

    return result;
  };

  return { getSortedEdfParams };
}
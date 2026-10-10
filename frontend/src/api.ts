// src/api.ts
const BASE = "http://10.62.233.86:8000";

// 定义数据格式（如果队长后端返回的字段名不同，这里要跟着改）
export interface KpiData {
  timestamp: string; // 如果队长返回的是 timestamp，这里要改成 timestamp
  sinr: number;
  throughput: number;
}

export const fetchKpiData = async (scenario: string = '校园'): Promise<KpiData[]> => {
  try {
    // 派“跑腿小哥”去队长给的地址拿数据
    const res = await fetch(`${BASE}/api/data/query?scenario=${scenario}`);
    const json = await res.json();
    
    // 队长规定：code为0才算成功
    if (json.code === 0) {
      return json.data.records; // 把真数据返回回去
    } else {
      console.error('后端返回异常:', json.msg);
      return [];
    }
  } catch (error) {
    console.error('连不上后端，请检查队长后端是否开启:', error);
    return []; // 如果断了，返回空数组，防止页面白屏崩溃
  }
};

// 告警数据接口（POST请求，需要传参数）
export interface AnomalyData {
  anomaly_type: string;
  cause: string;
  suggestion: string;
  affected_aps: string[];
}

export const fetchAnomalyData = async (): Promise<AnomalyData[]> => {
  try {
    const res = await fetch(`${BASE}/api/analyze/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 根据队长要求，传一个请求体
      body: JSON.stringify({
        scenario: '校园',
        window_start: '2026-09-29 00:00:00',
        window_end: '2026-09-29 23:59:59',
        metrics: ['sinr', 'throughput']
      }),
    });
    const json = await res.json();
        if (json.code === 0) {
      // 如果返回的是单个对象，就把它包成数组；如果是数组，直接用
      return Array.isArray(json.data) ? json.data : [json.data];
    }
    return [];
  } catch (error) {
    console.error('获取告警数据失败:', error);
    return [];
  }
};
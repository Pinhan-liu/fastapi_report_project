// 定义数据的类型
export interface KpiData {
  time: string;
  sinr: number;
  throughput: number;
}

// 导出的假数据
export const mockKpiData: KpiData[] = [
  { time: '08:00', sinr: 18, throughput: 45 },
  { time: '09:00', sinr: 22, throughput: 52 },
  { time: '10:00', sinr: 15, throughput: 38 },
  { time: '11:00', sinr: 25, throughput: 60 },
  { time: '12:00', sinr: 12, throughput: 30 },
  { time: '13:00', sinr: 20, throughput: 48 },
  { time: '14:00', sinr: 26, throughput: 65 },
  { time: '15:00', sinr: 23, throughput: 58 },
  { time: '16:00', sinr: 10, throughput: 25 },
  { time: '17:00', sinr: 19, throughput: 46 },
  { time: '18:00', sinr: 24, throughput: 55 },
  { time: '19:00', sinr: 21, throughput: 50 },
];
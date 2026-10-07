# -*- coding: utf-8 -*-
"""最终端到端验证：30d 全量 forecast + 抽查其他接口兼容"""
import requests

BASE = "http://localhost:8000"

# 1. forecast 30d 全量
r = requests.post(f"{BASE}/api/analyze/forecast",
                  json={"scenario": "校园", "window_start": "2026-01-01 00:00:00",
                        "window_end": "2026-01-31 23:59:59"}, timeout=180)
d = r.json()["data"]
print(f"[forecast-30d] HTTP {r.status_code} method={d['method']} bin={d['bin_size_min']} ues={len(d['ues'])}")
for ue in d["ues"][:1]:
    for m in d["metrics"]:
        s = d["series"][ue][m]
        print(f"  {ue} {m}: MAPE={s['mape']}% predicted={len(s.get('predicted', []))} "
              f"forecast={len(s['forecast'])} lower={len(s['lower'])} "
              f"fbin0={s['forecast_bins'][0] if s.get('forecast_bins') else None}")

# 2. 抽查兼容性：realtime（GET, 默认窗口）
r2 = requests.get(f"{BASE}/api/data/realtime", params={"scenario": "校园",
                   "start_time": "2026-01-01 00:00:00", "end_time": "2026-01-03 23:59:59"}, timeout=30)
print(f"[realtime] HTTP {r2.status_code} keys={list(r2.json()['data'].keys())[:6]}")

# 3. 抽查：heatmap（坐标热力图）
r3 = requests.get(f"{BASE}/api/data/heatmap", params={"scenario": "校园", "metric": "rsrp",
                  "start_time": "2026-01-01 00:00:00", "end_time": "2026-01-02 23:59:59"}, timeout=30)
print(f"[heatmap] HTTP {r3.status_code} grid_count={r3.json()['data'].get('grid_count')}")

# 4. 抽查：anomaly
r4 = requests.post(f"{BASE}/api/analyze/anomaly",
                   json={"scenario": "校园", "window_start": "2026-01-01 00:00:00",
                         "window_end": "2026-01-03 23:59:59"}, timeout=30)
print(f"[anomaly] HTTP {r4.status_code} alerts={len(r4.json()['data'].get('alerts', []))}")
print("ALL DONE")

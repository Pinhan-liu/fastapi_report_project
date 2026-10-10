# -*- coding: utf-8 -*-
"""实测 forecast_model：30d 数据真实预测 + 与 moving_average baseline 对比"""
import time
import pandas as pd
import requests
from forecast_model import build_series

# ---------- 1. 单元：30d 数据跑 Prophet ----------
df = pd.read_csv(r"F:\AI-NetTune\AI-NetTune\data\network_data_30d(1).csv")
rows = df.to_dict("records")
print(f"30d rows: {len(rows)}")

t0 = time.time()
built = build_series(rows)
elapsed = time.time() - t0
print(f"build_series 耗时: {elapsed:.1f}s, ues={built['ues']}, metrics={built['metrics']}, bin=60min")

lines = []
for ue, by_m in built["series"].items():
    for m, r in by_m.items():
        has_model = "predicted" in r and len(r.get("predicted", [])) > 0
        f_ok = len(r.get("forecast", [])) == 24 and len(r.get("lower", [])) == 24
        lines.append(
            f"{ue} {m:10s} true={r['true_mean']} pred={r['pred_mean']} MAPE={r['mape']}% "
            f"predicted_pts={len(r.get('predicted', []))} forecast_pts={len(r.get('forecast', []))} "
            f"lower0={r.get('lower', ['-'])[0]} upper0={r.get('upper', ['-'])[0]}"
        )
open(r"F:\AI-NetTune\AI-NetTune\_fc_unit.txt", "w", encoding="utf-8").write("\n".join(lines))

# ---------- 2. 端到端：接口结构（默认3天窗口，network_data.csv） ----------
try:
    resp = requests.post("http://localhost:8000/api/analyze/forecast",
                         json={"scenario": "校园", "window_start": "2026-01-01 00:00:00",
                               "window_end": "2026-01-03 23:59:59"}, timeout=120)
    d = resp.json()["data"]
    ue0 = d["ues"][0]
    m0 = d["metrics"][0]
    s = d["series"][ue0][m0]
    print(f"接口: HTTP {resp.status_code} method={d['method']} bin={d['bin_size_min']} "
          f"keys={sorted(s.keys())} forecast={len(s.get('forecast', []))}h")
except Exception as e:
    print(f"接口 FAILED: {e}")
print("DONE")

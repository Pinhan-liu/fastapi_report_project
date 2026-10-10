from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
import pandas as pd
import os
import time
from typing import Optional, List, Dict, Any

app = FastAPI(title="AI-NetTune Interface 8 & 9")

# 目录配置
TEMP_DIR = "temp_output"
os.makedirs(TEMP_DIR, exist_ok=True)
CSV_PATH = "network_data.csv"

# 场景白名单（和契约保持一致）
VALID_SCENARIOS = {"校园", "商场", "体育馆"}

# ===================== 原有接口 1~7 【请把你原来的接口1-7代码粘贴在这里】 =====================
# 【原有接口1~7，不要删除，用于第9条回归测试】
# @app.get("/api/xxx")
# ...

# ===================== 原有接口 /api/analyze/forecast 【保留，回归测试用】 =====================
@app.get("/api/analyze/forecast")
async def analyze_forecast():
    """回归测试接口，保留，保证可正常访问"""
    return {"code":200, "msg":"analyze forecast ok", "data":{}}

# ===================== 接口8 /api/predict/result =====================
@app.get("/api/predict/result")
async def api_predict_result(
    scenario: str = Query(..., description="场景名称，校园/商场/体育馆"),
    start_time: str = Query(...),
    end_time: str = Query(...),
    metric: str = Query(...),
    target_type: str = Query(...),
    interval: str = Query(...)
):
    # 1. 校验必填参数（FastAPI Query(...)会自动拦截空，这里业务校验场景合法性）
    if scenario not in VALID_SCENARIOS:
        raise HTTPException(status_code=200, detail={"code":40001, "msg":"缺少或非法必填参数", "data":None})

    # 2. 非法 metric / target_type / interval 返回40002
    valid_metrics = {"rsrp", "sinr"}
    valid_target_types = {"ap", "sta"}
    valid_intervals = {"1min","5min"}
    if metric not in valid_metrics or target_type not in valid_target_types or interval not in valid_intervals:
        return {"code":40002, "msg":"非法metric/target_type/interval", "data":None}

    # 3. 时间格式校验，简单示例
    try:
        pd.to_datetime(start_time)
        pd.to_datetime(end_time)
    except Exception:
        return {"code":40002, "msg":"非法时间格式", "data":None}

    # 契约正常返回要求：predict_list=[], total=0, model=placeholder
    return {
        "code":200,
        "msg":"success",
        "data":{
            "predict_list": [],
            "total": 0,
            "model": "placeholder"
        }
    }

# ===================== 接口9 /api/network/topology/enhanced =====================
@app.get("/api/network/topology/enhanced")
async def api_network_topology_enhanced(
    scenario: str = Query(...),
    time: Optional[str] = Query(None),
    include_metrics: bool = Query(True)
):
    df = pd.read_csv(CSV_PATH)
    df["time"] = pd.to_datetime(df["time"])

    # 不传time，取数据集最新时刻
    if time is None:
        target_dt = df["time"].max()
    else:
        try:
            target_dt = pd.to_datetime(time)
        except:
            return {"code":200, "msg":"success", "data":{"nodes": [], "links": [], "stats":{}}}

    # 筛选数据
    filter_df = df[(df["time"] == target_dt) & (df["scenario"] == scenario)]
    if len(filter_df) == 0:
        # 无数据时刻，nodes、links返回空数组
        return {"code":200, "msg":"success", "data":{"nodes": [], "links": [], "stats":{}}}

    # 构造nodes links
    nodes = []
    links = []
    stats = {"sample_count": len(filter_df)}
    for _, row in filter_df.iterrows():
        nodes.append({"id": row["target_id"], "type": row["target_type"]})
        link_item = {"source": row["source"], "target": row["target_id"]}
        if include_metrics is True:
            link_item["metrics"] = {"rsrp": row["rsrp"], "sinr": row["sinr"]}
        # include_metrics=false 时，links中不包含metrics键
        links.append(link_item)

    return {
        "code":200,
        "msg":"success",
        "data":{
            "nodes": nodes,
            "links": links,
            "stats": stats
        }
    }

# ===================== 报表生成、下载接口（不属于待清理接口，保留） =====================
@app.post("/api/generate-report")
async def generate_report(file: UploadFile = File(...)):
    import openpyxl
    timestamp = int(time.time())
    filename = f"统计报表_{timestamp}.xlsx"
    save_path = os.path.join(TEMP_DIR, filename)
    df = pd.read_csv(file.file)
    with pd.ExcelWriter(save_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    return {"code":200, "msg":"报表生成完成", "data":{"filename":filename}}

@app.get("/api/download-report/{filename}")
async def download_report(filename: str):
    file_path = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(file_path):
        return {"code":40401, "msg":"文件不存在", "data":None}
    return FileResponse(file_path, filename=filename)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

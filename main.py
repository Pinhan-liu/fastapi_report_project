from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
import pandas as pd
from datetime import datetime
import os
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="报表导出接口", version="1.0")

def success_response(data: dict, code: int = 200, msg: str = "success"):
    return {
        "code": code,
        "msg": msg,
        "data": data
    }

os.makedirs("temp_output", exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root_check():
    return {"msg": "FastAPI报表服务运行正常", "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

@app.post("/api/generate-report")
async def generate_report(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    stat_result = df.describe().reset_index()
    output_path = f"temp_output/统计报表_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    with pd.ExcelWriter(output_path) as writer:
        df.to_excel(writer, sheet_name="原始数据", index=False)
        stat_result.to_excel(writer, sheet_name="统计结果", index=False)
    
    return {
        "status": "success",
        "filename": os.path.basename(output_path),
        "msg": "报表生成完成"
    }

@app.get("/api/download-report/{filename}")
def download_report(filename: str):
    file_path = f"temp_output/{filename}"
    if not os.path.exists(file_path):
        return {"status": "error", "msg": "文件不存在"}
    return FileResponse(file_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=filename)

@app.post("/api/predict")
def predict_value(input_num: float):
    predict_result = input_num * 1.2
    return {
        "input": input_num,
        "predict_result": round(predict_result, 2),
        "generate_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
@app.get("/api/predict/result", summary="获取预测结果")
def get_predict_result(
    scenario: str = Query(...),
    start_time: int = Query(...),
    end_time: int = Query(...),
    target_type: str = Query(...),
    metric: str = Query(...)
):
    df = pd.read_csv("network_data.csv")
    df["timestamp"] = pd.to_datetime(df["timestamp"]).astype("int64") // 10**9
    filtered_df = df[
    (df["timestamp"] >= start_time) & 
    (df["timestamp"] <= end_time)
]

    predict_list = filtered_df.to_dict("records")
    return success_response(data={
        "predict_list": predict_list,
        "total": len(predict_list),
        "model": "network_predict_v1"
    })

@app.get("/api/predict/export", summary="导出预测结果报表")
def export_predict_result(
    scenario: str = Query(...),
    start_time: int = Query(...),
    end_time: int = Query(...),
    target_type: str = Query(...),
    metric: str = Query(...)
):
    try:
        df = pd.read_csv("network_data.csv")
        df["timestamp"] = pd.to_datetime(df["timestamp"]).astype("int64") // 10**9
        filtered_df = df[
    (df["timestamp"] >= start_time) & 
    (df["timestamp"] <= end_time)
]


        # 用英文文件名彻底避免Windows中文路径兼容问题
        export_filename = f"predict_export_{scenario}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        save_path = os.path.join("temp_output", export_filename)
        
        filtered_df.to_csv(save_path, index=False, encoding="utf-8-sig")

        return FileResponse(
            path=save_path,
            filename=export_filename,
            media_type="text/csv"
        )
    except Exception as e:
        # 打印具体错误到终端方便排查
        print(f"导出接口错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

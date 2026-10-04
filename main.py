from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import pandas as pd
from datetime import datetime
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="报表导出接口", version="1.0")
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

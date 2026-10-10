import time
import random
import threading
from datetime import datetime

# 线程安全的内存缓冲区
_realtime_buffer = []
_buffer_lock = threading.Lock()

# 3个AP的基准指标，与历史数据范围对齐
_AP_BASE_CONFIG = {
    "AP-01": {
        "rsrp": -92.0, "sinr": 6.5, "throughput": 55.0,
        "latency": 22.0, "packet_loss": 0.3, "prb_usage": 62.0
    },
    "AP-02": {
        "rsrp": -95.0, "sinr": 5.8, "throughput": 50.0,
        "latency": 25.0, "packet_loss": 0.5, "prb_usage": 65.0
    },
    "AP-03": {
        "rsrp": -90.0, "sinr": 7.2, "throughput": 60.0,
        "latency": 20.0, "packet_loss": 0.2, "prb_usage": 58.0
    }
}

# 完整18列字段名，与CSV、历史查询接口完全一致
DATA_COLUMNS = [
    "timestamp", "ap_id", "ue_id", "rsrp", "sinr", "throughput",
    "latency", "packet_loss", "prb_usage", "network_status",
    "bandwidth", "frequency", "modulation", "mimo", "distance",
    "user_count", "traffic_volume", "interference_level"
]


def _generate_single_batch():
    """生成一批（3个AP各1条）实时模拟数据"""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    batch_records = []

    for ap_id, base in _AP_BASE_CONFIG.items():
        # 指标小幅随机波动，模拟真实场景变化
        record = {
            "timestamp": now_str,
            "ap_id": ap_id,
            "ue_id": f"UE-0{random.randint(1, 9)}",
            "rsrp": round(base["rsrp"] + random.uniform(-3.0, 3.0), 1),
            "sinr": round(base["sinr"] + random.uniform(-1.0, 1.0), 1),
            "throughput": round(base["throughput"] + random.uniform(-5.0, 5.0), 1),
            "latency": round(base["latency"] + random.uniform(-2.0, 2.0), 1),
            "packet_loss": round(base["packet_loss"] + random.uniform(-0.1, 0.1), 2),
            "prb_usage": round(base["prb_usage"] + random.uniform(-3.0, 3.0), 1),
            "network_status": "normal" if random.random() > 0.1 else "congestion",
            "bandwidth": 100,
            "frequency": 2600,
            "modulation": "64QAM" if random.random() > 0.8 else "QPSK",
            "mimo": "2x2",
            "distance": round(random.uniform(10.0, 80.0), 1),
            "user_count": random.randint(5, 20),
            "traffic_volume": round(random.uniform(0.5, 2.0), 2),
            "interference_level": round(random.uniform(-110.0, -90.0), 1),
        }
        batch_records.append(record)

    # 写入缓冲区，保留最近1000条
    with _buffer_lock:
        _realtime_buffer.extend(batch_records)
        if len(_realtime_buffer) > 1000:
            _realtime_buffer[:] = _realtime_buffer[-1000:]


def start_realtime_service(interval_seconds: int = 60):
    """
    启动实时数据模拟后台服务
    :param interval_seconds: 数据生成间隔，默认60秒（分钟级）
    """
    def _run_loop():
        _generate_single_batch()  # 启动时先生成一批初始数据
        while True:
            time.sleep(interval_seconds)
            try:
                _generate_single_batch()
            except Exception as e:
                print(f"[实时模拟] 生成数据异常: {str(e)}")

    daemon_thread = threading.Thread(target=_run_loop, daemon=True)
    daemon_thread.start()
    print(f"[实时模拟] 服务已启动，数据生成间隔 {interval_seconds} 秒")


def get_incremental_data(last_time: str = None):
    """
    获取大于指定时间的增量数据
    :param last_time: 上次拉取的最大时间戳，格式 yyyy-MM-dd HH:mm:ss
    :return: 增量数据列表
    """
    with _buffer_lock:
        if not _realtime_buffer:
            return []

        if last_time is None:
            return _realtime_buffer[-10:]  # 不传时间默认返回最近10条

        result = []
        for record in _realtime_buffer:
            if record["timestamp"] > last_time:
                result.append(record)
        return result

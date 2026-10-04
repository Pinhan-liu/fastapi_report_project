# llm_agent.py —— LLM 意图解析 + 工具编排（第2周：程思源）
# 职责：听懂用户自然语言 → 输出四分类意图 JSON → 交给 main.py 的确定性接口执行
# 降级：LLM 不可用/超时/输出乱时，自动退回关键词规则版，保证演示不掉链子
import json
import os
import re
import requests

# ===== 大模型配置（⚠️ 安全：key 一律走环境变量，禁止写入代码/提交仓库）=====
# 永久设置一次（新开终端即生效）：setx LLM_API_KEY "sk-你的真实key"
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
# DeepSeek / 豆包 / OpenAI 兼容接口都行，改 URL 和模型名即可
LLM_URL = os.getenv("LLM_URL", "https://api.deepseek.com/chat/completions")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

SYSTEM_PROMPT = """你是无线网络监测平台的意图解析器。用户输入一句关于网络监测的自然语言，请判断意图并提取参数，只输出一个 JSON，不要输出任何其他文字：
{"intent": "query_kpi | fault_diagnosis | get_heatmap | get_topology | chat", "params": {...}}
- query_kpi：查KPI数据。params 含 scenario、metric(rsrp/sinr/throughput)、time_range(如"最近1小时")
- fault_diagnosis：故障研判。params 含 scenario、time_range。用户询问网络体验/质量/好坏/是否正常/分析原因/拥塞/信号差等问题时，优先选本意图
- get_heatmap：热力图。params 含 scenario、metric(默认rsrp)
- get_topology：网络拓扑。params 含 scenario
- chat：闲聊/无法判断。params 含 reply(你的简短回答)
不要编造时间，用户没说就用空字符串。"""


def call_llm(message: str) -> str:
    """调用大模型，返回原始文本。超时/网络错误会抛异常，由上层降级。"""
    resp = requests.post(
        LLM_URL,
        json={
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            "temperature": 0,
        },
        headers={"Authorization": f"Bearer {LLM_API_KEY}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def parse_intent(text: str) -> dict:
    """解析 LLM 输出：先整体 JSON 解析 → 正则抓大括号块 → 都失败抛异常走降级。"""
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "intent" in obj:
            return obj
    except Exception:
        pass
    m = re.search(r"\{.*\}", text, re.S)  # LLM 常带多余文字，抓 JSON 块
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and "intent" in obj:
                return obj
        except Exception:
            pass
    raise ValueError("LLM 输出无法解析: " + text[:100])


def rule_intent(message: str) -> dict:
    """关键词规则版（fallback：LLM 挂了/超时/输出乱时用，保住核心链路可用）
    第2周升级：①场景关键词提取（校园/商场/体育馆）②研判/热力/拓扑关键词扩充，
    让降级结果从"答非所问"变为"基本答对"。"""
    # ① 提取场景（与 CSV 场景一致），用户没提场景则为空 → 上层回退默认
    scenario = next((s for s in ("校园", "商场", "体育馆") if s in message), None)
    params = {"scenario": scenario} if scenario else {}
    # ② 明确的工具意图优先（避免"信号热力图"被宽泛的"信号/看看"关键词抢成研判）
    if "热力" in message or "信号分布" in message or "覆盖图" in message or "覆盖热" in message:
        return {"intent": "get_heatmap", "params": params}
    if "拓扑" in message or "基站" in message or "连接关系" in message:
        return {"intent": "get_topology", "params": params}
    # ③ 研判关键词（含"覆盖/弱"，覆盖问题归研判；"AP"本身不构成拓扑意图）
    anomaly_keywords = ["异常", "问题", "故障", "卡", "不好", "差", "掉线", "信号", "网络",
                        "体验", "质量", "稳定", "怎么样", "什么情况", "看看", "拥塞", "弱", "覆盖"]
    if any(k in message for k in anomaly_keywords):
        return {"intent": "fault_diagnosis", "params": params}
    return {"intent": "query_kpi", "params": params}


def get_intent(message: str) -> dict:
    """总入口：LLM 优先，任何异常都降级到规则版（这就是申报书里的 API 降级）"""
    try:
        return parse_intent(call_llm(message))
    except Exception:
        return rule_intent(message)

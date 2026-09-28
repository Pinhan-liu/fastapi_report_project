# AI-NetTune

**基于 LLM 意图驱动的无蜂窝无线网络智能监测与辅助分析平台**

面向 6G 无蜂窝大规模 MIMO（Cell-Free Massive MIMO）场景的 Web 智能监测平台：让**不懂通信 KPI 的人**也能通过自然语言对话，看懂网络状态、问出故障原因、拿到处置建议。



***

## 项目简介

本项目将大语言模型（LLM）智能体意图驱动思想迁移至无线网络监测领域：



* **数据层**：支持仿真数据生成与 CSV 导入，模拟无蜂窝网络的多 AP、多用户监测场景；

* **智能层**：内置通信 KPI 语义层，将 RSRP、SINR、吞吐量等专业指标翻译为自然语言；多 KPI 联合研判引擎结合通信专业知识输出**可解释**的故障结论（覆盖故障 / 网络拥塞 / 边缘弱用户）；

* **交互层**：用户通过自然语言提问，即可完成数据查询、故障研判、报告导出；

* **可靠性**：大模型仅负责语义理解，数据运算交由确定性工具执行，规避幻觉问题；大模型 API 不可用时，传统监测、告警、可视化功能可降级使用。

## 功能特性



* ✅ 通信 KPI 可视化（折线图 / 信号热力图 / 网络拓扑图）

* ✅ 多 KPI 联合故障研判，输出 "故障类型 → 证据链 → 原因 → 处置建议"

* ✅ 自然语言对话式监测（LLM 意图识别）

* ✅ 分析报告导出

* ✅ 仿真数据生成 + CSV 导入

* 🚧 React + TypeScript 前端（开发中）

## 技术栈



| 层级 | 技术                                        |
| ---- | ------------------------------------------- |
| 前端 | React + TypeScript + ECharts                |
| 后端 | Python + FastAPI + Uvicorn                  |
| AI   | 大模型 API（LLM 意图理解）+ 通信 KPI 语义层 |
| 数据 | CSV（pandas 读取）                          |

## 快速开始

### 后端（当前已可运行）



```
\# 1. 安装依赖

python -m pip install fastapi uvicorn pandas

\# 2. 启动服务

python -m uvicorn main:app --reload
```

浏览器打开 [http://localhost:8000/docs](http://localhost:8000/docs) 查看 Swagger 接口测试面板。

> 当前接口返回模拟数据用于跑通链路，后续将接入真实仿真数据与研判逻辑。

### 前端（开发中）



```
cd frontend

npm install

npm run dev
```

## API 接口一览



| 接口 | 方法 | 路径                 | 用途                |
| ---- | ---- | -------------------- | ------------------- |
| 1    | GET  | /api/data/query      | 查询监测数据        |
| 2    | POST | /api/analyze/anomaly | 多 KPI 联合故障研判 |
| 3    | POST | /api/agent/chat      | 自然语言对话        |
| 4    | POST | /api/export/report   | 导出分析报告        |

详细请求 / 响应格式见 [docs/api.md](docs/api.md)。

## 数据字典（CSV 格式）



| 列名         | 含义             | 单位                   |
| ------------ | ---------------- | ---------------------- |
| timestamp    | 采样时间         | yyyy-MM-dd HH:mm:ss    |
| ap\_id       | 接入点编号       | -                      |
| user\_id     | 用户编号         | -                      |
| rsrp         | 参考信号接收功率 | dBm                    |
| sinr         | 信干噪比         | dB                     |
| throughput   | 吞吐量           | Mbps                   |
| latency      | 时延             | ms                     |
| packet\_loss | 丢包率           | %                      |
| prb\_usage   | PRB 利用率       | %                      |
| scenario     | 场景标签         | 校园 / 商场 / 体育馆等 |

## 目录结构



```
AI-NetTune/

├── main.py          # 后端主程序（FastAPI，4 个接口）

├── docs/

│   └── api.md       # API 接口契约文档

├── frontend/        # React 前端（开发中）

└── README.md
```

## 开发路线



| 周次    | 目标                                   |
| ------- | -------------------------------------- |
| 第 1 周 | 接口契约 + 后端骨架打通                |
| 第 2 周 | 仿真数据生成 + 真实研判逻辑 + 监测看板 |
| 第 3 周 | LLM 意图驱动对话 + 前后端联调          |
| 第 4 周 | 打磨、Docker 部署、演示与答辩          |

## 团队成员



| 成员           | 分工                                                         |
| -------------- | ------------------------------------------------------------ |
| 程思源（队长） | 产品经理、系统架构、通信规则与仿真数据、故障研判引擎、LLM-Agent、报告导出 |
| 唐苗           | 通信 KPI 语义层、后端工具接口、Agent 工具函数                |
| 姚欣彤         | React 前端开发、ECharts 可视化、对话 UI、Docker 部署         |

## 参考



* [WirelessNetAgent (radiomap.online)](https://www.radiomap.online/)：LLM 驱动的无蜂窝网络优化智能体，本项目以其为场景参考，聚焦 "监测与研判" 差异化方向。

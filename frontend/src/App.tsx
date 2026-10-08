import { Link, Navigate, Route, Routes } from "react-router-dom";
import AppHeader from "./components/layout/AppHeader";
import HomePage from "./pages/home/HomePage";
import WorkbenchPage from "./pages/workbench/WorkbenchPage";
import "./App.css";

function PendingPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="ain-pending-page">
      <span className="ain-page-tag">页面框架已预留</span>

      <h1>{title}</h1>
      <p>{description}</p>

      <Link
        className="ain-button ain-primary"
        to="/workbench"
      >
        进入现存问题工作台
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <div className="ain-app ain-shell">
      {/* 低调的基站与信号背景，不接收鼠标操作 */}
      <svg
        className="ain-background"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <g
            id="ain-tower"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M0 0 L-28 150 H28 Z M-20 110 L16 65 M20 110 L-16 65 M-28 150 L20 110 M28 150 L-20 110 M-16 65 H16 M-20 110 H20" />
            <path d="M-9 -8 Q-24 5 -9 18 M9 -8 Q24 5 9 18 M-17 -18 Q-43 5 -17 28 M17 -18 Q43 5 17 28" />
          </g>
        </defs>

        <use
          href="#ain-tower"
          transform="translate(45 700)"
        />
        <use
          href="#ain-tower"
          transform="translate(1560 270) scale(.8)"
        />

        <g
          className="ain-signal-wave"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="45" cy="705" r="100" />
          <circle cx="45" cy="705" r="180" />
          <circle cx="45" cy="705" r="260" />
          <circle cx="1560" cy="275" r="100" />
          <circle cx="1560" cy="275" r="180" />
        </g>
      </svg>

      <AppHeader />

      <Routes>
        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/workbench"
          element={<WorkbenchPage />}
        />

        <Route
          path="/prediction"
          element={
            <PendingPage
              title="预测分析"
              description="这里将组织时间预测、空间风险与预测效果评估。当前批次先完成入口；已有预测对比仍保留在现存问题工作台。"
            />
          }
        />

        <Route
          path="/history"
          element={
            <PendingPage
              title="分析记录"
              description="这里将汇总问题、研判证据、调整方案和验证结果。当前批次先完成入口，尚未接入分析保存与记录列表。"
            />
          }
        />

        <Route
          path="/dashboard"
          element={<Navigate to="/workbench" replace />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>

      <footer className="ain-footer">
        <span>
          AI-NetTune · 观察网络，追溯原因，调整验证
        </span>
        <span>
          数据来源与分析范围以工作台标识为准
        </span>
      </footer>
    </div>
  );
}
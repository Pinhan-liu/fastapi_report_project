import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import "./App.css";

import AppHeader from "./components/layout/AppHeader";
import WorkbenchPage from "./pages/workbench/WorkbenchPage";

function HomeEntry() {
  const navigate = useNavigate();

  return (
    <main className="ain-home">
      <p className="ain-eyebrow">
        AI-NETTUNE / NETWORK WORKSPACE
      </p>

      <h1>
        看清网络状态，
        <br />
        理解问题原因。
      </h1>

      <p className="ain-home-description">
        把网络指标、空间分布与服务关系放在同一个工作台中，
        围绕具体对象展开分析，并逐步形成管理与验证闭环。
      </p>

      <button
        className="ain-button ain-primary"
        onClick={() => navigate("/workbench")}
      >
        进入网络工作台
      </button>

      <div className="ain-home-flow">
        <article>
          <h2>观察网络</h2>
          <p className="ain-muted">
            从指标、地图和拓扑理解网络状态。
          </p>
        </article>

        <article>
          <h2>分析原因</h2>
          <p className="ain-muted">
            围绕候选原因组织支持证据与待验证项。
          </p>
        </article>

        <article>
          <h2>管理与验证</h2>
          <p className="ain-muted">
            后续接入配置调整和方案对比。
          </p>
        </article>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <div className="ain-app">
      <AppHeader />

      <Routes>
        <Route
          path="/"
          element={<HomeEntry />}
        />

        <Route
          path="/workbench"
          element={<WorkbenchPage />}
        />

        <Route
          path="/dashboard"
          element={
            <Navigate to="/workbench" replace />
          }
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>

      <footer className="ain-footer">
        <span>
          AI-NetTune · 观察 / 分析 / 管理
        </span>

        <span>
          前端展示开发中 · 数据来源以工作台标识为准
        </span>
      </footer>
    </div>
  );
}
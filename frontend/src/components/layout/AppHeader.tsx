import { NavLink } from "react-router-dom";
import "./AppHeader.css";

export default function AppHeader() {
  return (
    <header className="ain-header">
      <NavLink to="/" className="ain-brand" aria-label="AI-NetTune 首页">
        <span className="ain-brand-icon">AI</span>
        <span><strong>AI-NetTune</strong><small>WIRELESS NETWORK WORKSPACE</small></span>
      </NavLink>
      <nav className="ain-nav" aria-label="主导航">
        <NavLink to="/" end>首页</NavLink>
        <NavLink to="/workbench">现存问题</NavLink>
        <span className="ain-nav-pending" aria-disabled="true" title="后续开发">预测分析</span>
        <span className="ain-nav-pending" aria-disabled="true" title="后续开发">分析记录</span>
      </nav>
      <span className="ain-header-status">
        <i aria-hidden="true" />
        后端接口模式
      </span>
    </header>
  );
}

import { Link } from "react-router-dom";

const workflow = [
  ["观察网络", "查看指标、信号分布与服务连接。"],
  ["发现或预测问题", "定位现存异常，关注潜在风险。"],
  ["分析原因", "对照候选原因、支持证据与限制。"],
  ["制定调整方案", "把研判结果转为待验证的建议。"],
  ["操作仿真", "确认参数后运行调整方案。"],
  ["观察影响", "比较基线与方案的指标变化。"],
  ["再次调整", "依据验证结果继续改进方案。"],
];

export default function HomePage() {
  return (
    <main className="ain-home-page">
      <section
        className="ain-home-hero"
        aria-labelledby="ain-home-title"
      >
        <span className="ain-page-tag">
          自然语言驱动的网络分析工作台
        </span>

        <h1
          id="ain-home-title"
          className="ain-home-title"
        >
          看清网络状态，
          <br />
          <em>让分析与调整有据可循。</em>
        </h1>

        <p className="ain-home-lead">
          用一句话查询网络，把指标、空间分布和连接关系联系起来，
          追溯异常的候选原因，并逐步通过仿真验证调整效果。
        </p>

        <div className="ain-home-actions">
          <Link
            className="ain-button ain-primary"
            to="/workbench"
          >
            分析现存问题 →
          </Link>

          <Link
            className="ain-button"
            to="/prediction"
          >
            查看预测分析
          </Link>
        </div>

        <p className="ain-home-status">
          当前已接入指标、采样热力图、拓扑、故障研判与对话查询；
          动态管理与独立预测页面将分批完善。
        </p>
      </section>

      <section
        className="ain-home-ai"
        aria-labelledby="ain-home-ai-title"
      >
        <div>
          <span className="ain-page-tag">
            大模型交互
          </span>

          <h2 id="ain-home-ai-title">
            把问题交给 AI，把依据留在图表中。
          </h2>

          <p>
            自然语言进入分析流程，工具返回的数据和研判结果可继续核查。
            模型或规则处理模式由后端决定。
          </p>
        </div>

        <div className="ain-home-example">
          <span>示例提问</span>

          <p>
            “校园有没有网络异常？请分析原因。”
          </p>

          <div className="ain-home-tool-flow">
            <span>理解问题</span>
            <b>→</b>
            <span>调用工具</span>
            <b>→</b>
            <span>返回数据与证据</span>
          </div>

          <Link to="/workbench">
            进入工作台提问 →
          </Link>
        </div>
      </section>

      <section
        className="ain-home-process"
        aria-labelledby="ain-home-process-title"
      >
        <div className="ain-home-section-heading">
          <h2 id="ain-home-process-title">
            从发现问题，到反复验证
          </h2>
          <p>产品的完整工作路线</p>
        </div>

        <ol className="ain-workflow">
          {workflow.map(([title, description], index) => (
            <li key={title}>
              <span className="ain-workflow-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="ain-home-entry-grid"
        aria-label="两类问题入口"
      >
        <article className="ain-home-entry">
          <span className="ain-page-tag">
            现存问题
          </span>

          <h2>哪里异常？为什么发生？</h2>

          <p>
            联合查看核心指标、Radio Map、网络拓扑和时间趋势，
            集中核查候选原因及其证据。
          </p>

          <Link to="/workbench">
            进入现存问题 →
          </Link>
        </article>

        <article className="ain-home-entry">
          <span className="ain-page-tag">
            预测分析 · 页面建设中
          </span>

          <h2>
            接下来怎样变化？哪里可能有风险？
          </h2>

          <p>
            围绕时间变化与空间分布组织预测分析，并核查预测结果。
            独立页面将在后续批次接入。
          </p>

          <Link to="/prediction">
            查看预测入口 →
          </Link>
        </article>
      </section>
    </main>
  );
}
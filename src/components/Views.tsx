import type { Rule, RuleScanResult, CleanReport } from "../types";
import { formatBytes } from "../format";
import { IconAlert, IconCheck } from "../icons";

export interface CleanItemState {
  rule_id: string;
  name: string;
  status: "pending" | "running" | "done";
  freed: number;
  deleted: number;
  failed: number;
}

export function ConfirmModal(props: {
  rules: Rule[];
  results: Map<string, RuleScanResult>;
  selection: Set<string>;
  elevated: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const picked = props.rules.filter((r) => props.selection.has(r.id));
  const hasCaution = picked.some((r) => r.risk === "caution");
  const hasAdvanced = picked.some((r) => r.risk === "advanced");
  const hasAdmin = picked.some((r) => r.requires_admin) && !props.elevated;
  const total = picked.reduce(
    (s, r) => s + (props.results.get(r.id)?.total_size ?? 0),
    0
  );
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>确认清理</h2>
        <p className="modal-sub">
          即将清理以下 {picked.length} 个项目，预计可释放{" "}
          <b className="hl">{formatBytes(total)}</b>：
        </p>
        <ul className="confirm-list">
          {picked.map((r) => (
            <li key={r.id}>
              <span className={`dot risk-bg-${r.risk}`} />
              <span className="c-name">{r.name}</span>
              <span className="c-size">
                {formatBytes(props.results.get(r.id)?.total_size ?? 0)}
              </span>
            </li>
          ))}
        </ul>
        <div className="warnings">
          {hasCaution && (
            <p className="warn warn-caution">
              <IconAlert size={14} /> 谨慎项目包含你的个人文件（下载、录屏、聊天缓存等），删除后无法轻易找回，请先在列表里展开确认。
            </p>
          )}
          {hasAdvanced && (
            <p className="warn warn-advanced">
              <IconAlert size={14} /> 高级项目将执行系统级操作（DISM 组件清理 / 休眠文件调整），耗时较长，期间请勿关机重启。
            </p>
          )}
          {hasAdmin && (
            <p className="warn warn-caution">
              <IconAlert size={14} /> 有 {picked.filter((r) => r.requires_admin).length} 个项目需要管理员权限，当前为普通权限，这些项目将清理失败。请退出后右键“以管理员身份运行”。
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={props.onCancel}>
            取消
          </button>
          <button className="btn primary" onClick={props.onConfirm}>
            开始清理
          </button>
        </div>
      </div>
    </div>
  );
}

export function AboutModal(props: { onClose(): void }) {
  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>关于 CSweeper</h2>
        <p className="modal-sub">C盘清道夫 · 开源的 C 盘清理工具 v0.1.0</p>
        <div className="about-body">
          <p><b>安全设计</b></p>
          <ul>
            <li>所有删除默认进入回收站，可随时还原</li>
            <li>清理前必须勾选 + 二次确认，所见即所删</li>
            <li>“谨慎 / 高级”项目默认不勾选，含个人文件或系统操作</li>
            <li>绝不触碰 C:\Windows\Installer 等危险目录</li>
            <li>WinSxS 清理走系统 DISM 接口，不直接删文件</li>
          </ul>
          <p className="muted">
            本软件按“现状”提供，清理系统文件存在固有风险，重要数据请自行备份。
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={props.onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

export function CleanProgressView(props: {
  items: CleanItemState[];
  done: boolean;
}) {
  const freed = props.items.reduce((s, i) => s + i.freed, 0);
  return (
    <div className="clean-progress">
      <h2 className="cp-title">{props.done ? "清理完成" : "正在清理…"}</h2>
      {!props.done && <div className="cp-bar"><div className="cp-bar-inner indeterminate" /></div>}
      <p className="cp-freed hl">{formatBytes(freed)}</p>
      <div className="cp-list">
        {props.items.map((i) => (
          <div key={i.rule_id} className={`cp-item ${i.status}`}>
            <span className="cp-status">
              {i.status === "done" ? (
                <IconCheck size={15} />
              ) : i.status === "running" ? (
                <span className="spinner" />
              ) : (
                <span className="cp-wait">·</span>
              )}
            </span>
            <span className="c-name">{i.name}</span>
            <span className="c-size">{i.status === "done" ? `已释放 ${formatBytes(i.freed)}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultView(props: {
  rules: Rule[];
  report: CleanReport;
  onRescan(): void;
  onDone(): void;
}) {
  const nameOf = (id: string) => props.rules.find((r) => r.id === id)?.name ?? id;
  return (
    <div className="result-view">
      <div className="result-hero">
        <span className="result-icon"><IconCheck size={34} /></span>
        <div>
          <h2>本次共释放 {formatBytes(props.report.total_freed)}</h2>
          <p className="muted">
            {props.report.results.length} 个项目已处理
            {props.report.results.some((r) => r.failed > 0) ? "，部分文件清理失败（见下方详情）" : ""}
          </p>
        </div>
      </div>
      <div className="result-list">
        {props.report.results.map((r) => (
          <div key={r.rule_id} className="result-row">
            <div className="rr-main">
              <span className="c-name">{nameOf(r.rule_id)}</span>
              <span className="muted">
                清理 {r.deleted} 个文件
                {r.failed > 0 ? `，失败 ${r.failed} 个` : ""}
              </span>
            </div>
            <span className="c-size">{r.freed > 0 ? `+${formatBytes(r.freed)}` : "—"}</span>
            {r.note && <div className="note-box">{r.note}</div>}
            {r.errors.length > 0 && (
              <details className="err-details">
                <summary>失败详情（{r.errors.length}）</summary>
                <ul>
                  {r.errors.map((e, i) => (
                    <li key={i} title={e.path}>
                      {e.path} — {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
      <div className="modal-actions center">
        <button className="btn ghost" onClick={props.onDone}>
          完成
        </button>
        <button className="btn primary" onClick={props.onRescan}>
          重新扫描
        </button>
      </div>
    </div>
  );
}

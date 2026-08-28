import type { FC } from "react";
import type { GroupId, Rule, RuleScanResult } from "../types";
import { formatBytes, formatDate, basename } from "../format";
import {
  IconChat,
  IconChevron,
  IconChip,
  IconCode,
  IconFolder,
  IconGamepad,
  IconGlobe,
  IconLock,
  IconShield,
  IconZap,
} from "../icons";

const GROUPS: { id: GroupId; label: string; icon: FC<{ size?: number }> }[] = [
  { id: "system", label: "系统垃圾", icon: IconZap },
  { id: "driver", label: "驱动与显卡", icon: IconChip },
  { id: "browser", label: "浏览器", icon: IconGlobe },
  { id: "game", label: "游戏与录屏", icon: IconGamepad },
  { id: "chat", label: "聊天工具", icon: IconChat },
  { id: "dev", label: "开发者缓存", icon: IconCode },
  { id: "advanced", label: "高级系统项", icon: IconShield },
];

const RISK_LABEL: Record<string, string> = {
  safe: "安全",
  caution: "谨慎",
  advanced: "高级",
};

export function isSelectable(rule: Rule, res: RuleScanResult | undefined): boolean {
  if (!res) return false;
  if (res.error) return false;
  if (rule.special === "winxsx") return true;
  return res.total_size > 0;
}

interface RuleListProps {
  rules: Rule[];
  results: Map<string, RuleScanResult>;
  selection: Set<string>;
  elevated: boolean;
  expanded: string | null;
  collapsedGroups: Set<string>;
  onToggle(ruleId: string): void;
  onToggleGroup(groupId: string): void;
  onCollapseGroup(groupId: string): void;
  onExpand(ruleId: string | null): void;
  onOpenPath(path: string): void;
}

export function RuleList(props: RuleListProps) {
  const { rules, results } = props;
  return (
    <div className="rule-list">
      {GROUPS.map((g) => {
        const groupRules = rules
          .filter((r) => r.group === g.id)
          .sort(
            (a, b) =>
              (results.get(b.id)?.total_size ?? 0) -
              (results.get(a.id)?.total_size ?? 0)
          );
        if (groupRules.length === 0) return null;
        const groupSize = groupRules.reduce(
          (s, r) => s + (results.get(r.id)?.total_size ?? 0),
          0
        );
        const collapsed = props.collapsedGroups.has(g.id);
        return (
          <section key={g.id} className="group">
            <header className="group-header" onClick={() => props.onCollapseGroup(g.id)}>
              <span className="chevron muted" style={{ transform: collapsed ? "rotate(-90deg)" : undefined }}>
                <IconChevron size={14} />
              </span>
              <g.icon size={16} />
              <span className="group-label">{g.label}</span>
              <span className="group-size">{groupSize > 0 ? formatBytes(groupSize) : "无内容"}</span>
              <button
                className="link-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleGroup(g.id);
                }}
              >
                全选本组
              </button>
            </header>
            {!collapsed &&
              groupRules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  res={results.get(rule.id)}
                  selected={props.selection.has(rule.id)}
                  elevated={props.elevated}
                  expanded={props.expanded === rule.id}
                  onToggle={() => props.onToggle(rule.id)}
                  onExpand={() => props.onExpand(props.expanded === rule.id ? null : rule.id)}
                  onOpenPath={props.onOpenPath}
                />
              ))}
          </section>
        );
      })}
    </div>
  );
}

interface RuleRowProps {
  rule: Rule;
  res: RuleScanResult | undefined;
  selected: boolean;
  elevated: boolean;
  expanded: boolean;
  onToggle(): void;
  onExpand(): void;
  onOpenPath(path: string): void;
}

function RuleRow(p: RuleRowProps) {
  const { rule, res } = p;
  const selectable = isSelectable(rule, res);
  const empty = (res?.total_size ?? 0) === 0 && rule.special !== "winxsx";
  return (
    <div className={`rule-row ${empty ? "empty" : ""} ${p.expanded ? "expanded" : ""}`}>
      <div className="rule-line">
        <input
          type="checkbox"
          className="cbx"
          checked={p.selected}
          disabled={!selectable}
          onChange={p.onToggle}
        />
        <div className="rule-main">
          <div className="rule-title">
            <span className="rule-name">{rule.name}</span>
            <span className={`risk risk-${rule.risk}`}>{RISK_LABEL[rule.risk]}</span>
            {rule.requires_admin && !p.elevated && (
              <span className="admin-badge" title="此项需要以管理员身份运行 CSweeper 才能清理">
                <IconLock size={11} /> 需管理员
              </span>
            )}
            {res?.access_denied && (
              <span className="denied-badge" title="部分路径因权限不足未能统计完整">
                部分无权限
              </span>
            )}
          </div>
          <div className="rule-desc">{rule.description}</div>
        </div>
        <div className="rule-size">
          {empty ? (
            <span className="muted">未发现</span>
          ) : (
            <>
              <span className="size-num">{formatBytes(res?.total_size ?? 0)}</span>
              {res?.total_count ? <span className="size-count">{res.total_count.toLocaleString()} 项</span> : null}
            </>
          )}
        </div>
        <button className="expand-btn" onClick={p.onExpand} disabled={empty && !res?.note} title="展开详情">
          <IconChevron size={16} className="chevron" />
        </button>
      </div>
      {p.expanded && res && (
        <div className="rule-detail">
          {res.note && <div className="note-box">{res.note}</div>}
          {res.error && <div className="error-box">扫描出错：{res.error}</div>}
          {res.files.length > 0 && (
            <FileTable
              files={res.files}
              truncated={res.truncated}
              totalCount={res.total_count}
              onOpenPath={p.onOpenPath}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FileTable(props: {
  files: { path: string; size: number; modified: number }[];
  truncated: boolean;
  totalCount: number;
  onOpenPath(path: string): void;
}) {
  const rows = [...props.files].sort((a, b) => b.size - a.size).slice(0, 100);
  return (
    <div className="file-table">
      <div className="file-head">
        <span className="f-name">文件（按大小排序，最多显示 100）</span>
        <span className="f-size">大小</span>
        <span className="f-date">修改时间</span>
        <span className="f-act" />
      </div>
      {rows.map((f) => (
        <div key={f.path} className="file-row" title={f.path}>
          <span className="f-name" title={f.path}>
            {basename(f.path)}
          </span>
          <span className="f-size">{formatBytes(f.size)}</span>
          <span className="f-date">{formatDate(f.modified)}</span>
          <button className="f-act link-btn" onClick={() => props.onOpenPath(f.path)} title={f.path}>
            <IconFolder size={14} />
          </button>
        </div>
      ))}
      {props.totalCount > rows.length && (
        <div className="file-more muted">
          共 {props.totalCount.toLocaleString()} 个文件，已显示前 {rows.length} 个
          {props.truncated ? "（扫描预览上限 2000，清理时按同样规则全量执行）" : ""}
        </div>
      )}
    </div>
  );
}

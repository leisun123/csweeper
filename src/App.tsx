import { useEffect, useRef, useState } from "react";
import { backend } from "./api";
import type {
  DriveInfo,
  Rule,
  RuleScanResult,
  ScanProgress,
  ScanReport,
  DeleteMode,
  CleanReport,
} from "./types";
import { formatBytes, formatDuration } from "./format";
import { RuleList, isSelectable } from "./components/RuleList";
import {
  AboutModal,
  CleanItemState,
  CleanProgressView,
  ConfirmModal,
  ResultView,
} from "./components/Views";
import { IconGear, IconLogo, IconRefresh, IconShield } from "./icons";

type Phase = "idle" | "scanning" | "results" | "cleaning" | "done";

export default function App() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [drive, setDrive] = useState<DriveInfo | null>(null);
  const [elevated, setElevated] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [cleanItems, setCleanItems] = useState<CleanItemState[]>([]);
  const [cleanDone, setCleanDone] = useState(false);
  const [cleanReport, setCleanReport] = useState<CleanReport | null>(null);
  const resultsRef = useRef<Map<string, RuleScanResult>>(new Map());

  useEffect(() => {
    backend.getRules().then(setRules).catch(console.error);
    backend.driveInfo().then(setDrive).catch(console.error);
    backend.elevated().then(setElevated).catch(console.error);
  }, []);

  async function startScan() {
    setPhase("scanning");
    setExpanded(null);
    resultsRef.current = new Map();
    try {
      const rep = await backend.scan((p) => setScanProgress(p));
      resultsRef.current = new Map(rep.results.map((r) => [r.rule_id, r]));
      setReport(rep);
      setDrive(rep.drive);
      setElevated(rep.elevated);
      const init = new Set(
        rep.results
          .filter((res) => {
            const rule = (rules.length ? rules : []).find((r) => r.id === res.rule_id);
            return rule && rule.default_enabled && isSelectable(rule, res);
          })
          .map((r) => r.rule_id)
      );
      setSelection(init);
      setPhase("results");
    } catch (e) {
      console.error(e);
      setPhase("idle");
    } finally {
      setScanProgress(null);
    }
  }

  function toggleRule(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupId: string) {
    const groupRules = rules.filter(
      (r) => r.group === groupId && isSelectable(r, resultsRef.current.get(r.id))
    );
    const allSelected = groupRules.every((r) => selection.has(r.id));
    setSelection((prev) => {
      const next = new Set(prev);
      groupRules.forEach((r) => (allSelected ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  }

  function toggleCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function doClean(mode: DeleteMode) {
    setConfirmOpen(false);
    setPhase("cleaning");
    setCleanDone(false);
    const ordered = [...selection];
    setCleanItems(
      ordered.map((id) => ({
        rule_id: id,
        name: rules.find((r) => r.id === id)?.name ?? id,
        status: "pending",
        freed: 0,
        deleted: 0,
        failed: 0,
      }))
    );
    try {
      const rep = await backend.clean(ordered, mode, (p) => {
        setCleanItems((prev) =>
          prev.map((it) =>
            it.rule_id === p.rule_id
              ? {
                  ...it,
                  status: p.phase === "done" ? "done" : "running",
                  freed: p.freed,
                  deleted: p.deleted,
                  failed: p.failed,
                }
              : it
          )
        );
      });
      setCleanReport(rep);
      setCleanItems((prev) =>
        prev.map((it) => ({
          ...it,
          status: "done",
          freed: rep.results.find((r) => r.rule_id === it.rule_id)?.freed ?? it.freed,
        }))
      );
      setCleanDone(true);
      setPhase("done");
      backend.driveInfo().then(setDrive).catch(() => {});
    } catch (e) {
      console.error(e);
      setPhase("results");
    }
  }

  function finishSession() {
    setPhase("idle");
    setReport(null);
    setSelection(new Set());
    setCleanReport(null);
    setCleanItems([]);
  }

  const resultsMap = resultsRef.current;
  const selectedTotal = [...selection].reduce(
    (s, id) => s + (resultsMap.get(id)?.total_size ?? 0),
    0
  );
  const needsAdmin =
    !elevated && [...selection].some((id) => rules.find((r) => r.id === id)?.requires_admin);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo"><IconLogo size={22} /></span>
          <span className="brand-name">CSweeper</span>
          <span className="brand-sub">C盘清道夫</span>
        </div>
        <div className="topbar-right">
          {backend.kind === "mock" && <span className="mock-badge">演示数据</span>}
          <span className={`elev-badge ${elevated ? "ok" : ""}`} title={elevated ? "当前以管理员权限运行" : "建议右键以管理员身份运行以获得完整清理能力"}>
            <IconShield size={13} />
            {elevated ? "管理员模式" : "普通权限"}
          </span>
          <button className="icon-btn" onClick={() => setAboutOpen(true)} title="关于">
            <IconGear size={18} />
          </button>
        </div>
      </header>

      <main className="main">
        {phase === "idle" && (
          <div className="idle">
            <DriveCard drive={drive} />
            <div className="idle-actions">
              <button className="btn primary lg" onClick={startScan}>
                <IconRefresh size={17} /> 扫描 C 盘垃圾
              </button>
              <p className="muted">
                扫描约需几秒到一分钟，只统计已知安全规则覆盖的目录，不会移动任何文件。
              </p>
            </div>
          </div>
        )}

        {phase === "scanning" && (
          <div className="scanning">
            <div className="scan-ring" />
            {scanProgress && (
              <p className="scan-label">
                正在扫描：{scanProgress.name}
                <span className="muted">（{scanProgress.index}/{scanProgress.total}）</span>
              </p>
            )}
            <div className="scan-bar">
              <div
                className="scan-bar-inner"
                style={{ width: `${scanProgress ? (scanProgress.index / scanProgress.total) * 100 : 4}%` }}
              />
            </div>
          </div>
        )}

        {phase === "results" && report && (
          <div className="results">
            <DriveCard drive={drive} compact />
            <div className="results-meta muted">
              扫描完成，用时 {formatDuration(report.duration_ms)} · 共 {report.results.length} 类项目
            </div>
            <RuleList
              rules={rules}
              results={resultsMap}
              selection={selection}
              elevated={elevated}
              expanded={expanded}
              collapsedGroups={collapsedGroups}
              onToggle={toggleRule}
              onToggleGroup={toggleGroup}
              onCollapseGroup={toggleCollapse}
              onExpand={setExpanded}
              onOpenPath={(p) => backend.openPath(p).catch(console.error)}
            />
            <div className="footer-space" />
            <footer className="footer">
              <div className="footer-info">
                已选 <b>{selection.size}</b> 项 · 预计可释放 <b className="hl">{formatBytes(selectedTotal)}</b>
                {needsAdmin && <span className="footer-warn">部分项需管理员权限，将清理失败</span>}
              </div>
              <button
                className="btn primary lg"
                disabled={selection.size === 0}
                onClick={() => setConfirmOpen(true)}
              >
                开始清理
              </button>
            </footer>
          </div>
        )}

        {phase === "cleaning" && (
          <CleanProgressView items={cleanItems} done={cleanDone} />
        )}

        {phase === "done" && cleanReport && (
          <ResultView
            rules={rules}
            report={cleanReport}
            onRescan={startScan}
            onDone={finishSession}
          />
        )}
      </main>

      {confirmOpen && (
        <ConfirmModal
          rules={rules}
          results={resultsMap}
          selection={selection}
          elevated={elevated}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => doClean("recycle")}
        />
      )}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

function DriveCard(props: { drive: DriveInfo | null; compact?: boolean }) {
  const { drive } = props;
  if (!drive) return null;
  const used = drive.total_bytes - drive.free_bytes;
  const usedPct = Math.round((used / drive.total_bytes) * 100);
  return (
    <div className={`drive-card ${props.compact ? "compact" : ""}`}>
      <div className="drive-letter">C:</div>
      <div className="drive-body">
        <div className="drive-nums">
          <span>已用 {formatBytes(used)}</span>
          <span className="muted"> / 共 {formatBytes(drive.total_bytes)}</span>
          <span className="drive-free">剩余 {formatBytes(drive.free_bytes)}</span>
        </div>
        <div className="drive-bar">
          <div
            className={`drive-bar-inner ${usedPct >= 90 ? "danger" : usedPct >= 75 ? "warn" : ""}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

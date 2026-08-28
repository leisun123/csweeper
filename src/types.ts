export type Risk = "safe" | "caution" | "advanced";

export type GroupId =
  | "system"
  | "driver"
  | "browser"
  | "game"
  | "chat"
  | "dev"
  | "advanced";

export interface Rule {
  id: string;
  name: string;
  description: string;
  group: GroupId;
  risk: Risk;
  requires_admin: boolean;
  default_enabled: boolean;
  special?: string | null;
}

export interface FileEntry {
  path: string;
  size: number;
  modified: number;
}

export interface RuleScanResult {
  rule_id: string;
  total_size: number;
  total_count: number;
  files: FileEntry[];
  truncated: boolean;
  access_denied: boolean;
  error?: string | null;
  note?: string | null;
}

export interface DriveInfo {
  total_bytes: number;
  free_bytes: number;
}

export interface ScanReport {
  drive: DriveInfo;
  results: RuleScanResult[];
  duration_ms: number;
  elevated: boolean;
}

export interface CleanError {
  path: string;
  reason: string;
}

export interface CleanRuleResult {
  rule_id: string;
  freed: number;
  deleted: number;
  failed: number;
  errors: CleanError[];
  note?: string | null;
}

export interface CleanReport {
  total_freed: number;
  results: CleanRuleResult[];
}

export interface ScanProgress {
  index: number;
  total: number;
  rule_id: string;
  name: string;
}

export interface CleanProgress {
  rule_id: string;
  name: string;
  phase: "start" | "done";
  freed: number;
  deleted: number;
  failed: number;
}

export type DeleteMode = "recycle" | "permanent";

export interface Backend {
  kind: "tauri" | "mock";
  getRules(): Promise<Rule[]>;
  scan(onProgress: (p: ScanProgress) => void): Promise<ScanReport>;
  clean(
    ruleIds: string[],
    mode: DeleteMode,
    onProgress: (p: CleanProgress) => void
  ): Promise<CleanReport>;
  driveInfo(): Promise<DriveInfo>;
  elevated(): Promise<boolean>;
  openPath(path: string): Promise<void>;
}

import type {
  Backend,
  CleanProgress,
  CleanReport,
  DeleteMode,
  DriveInfo,
  Rule,
  RuleScanResult,
  ScanProgress,
  ScanReport,
} from "./types";
import { createMockBackend } from "./mock/mockBackend";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const tauriBackend: Backend = {
  kind: "tauri",
  async getRules(): Promise<Rule[]> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_rules");
  },
  scan(onProgress): Promise<ScanReport> {
    return (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<ScanProgress>("scan-progress", (e) =>
        onProgress(e.payload)
      );
      try {
        return await invoke("scan");
      } finally {
        un();
      }
    })();
  },
  clean(ruleIds, mode: DeleteMode, onProgress): Promise<CleanReport> {
    return (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<CleanProgress>("clean-progress", (e) =>
        onProgress(e.payload)
      );
      try {
        return await invoke("clean", { ids: ruleIds, mode });
      } finally {
        un();
      }
    })();
  },
  async driveInfo(): Promise<DriveInfo> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("drive_info");
  },
  async elevated(): Promise<boolean> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("is_elevated");
  },
  async openPath(path: string): Promise<void> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("open_path", { path });
  },
};

export const backend: Backend = isTauri ? tauriBackend : createMockBackend();

import type {
  Backend,
  CleanProgress,
  CleanReport,
  DeleteMode,
  FileEntry,
  Rule,
  RuleScanResult,
  ScanProgress,
  ScanReport,
} from "../types";
import { delay } from "../delayShim";

type MockSpec = {
  size: number;
  count: number;
  namePool: string[];
  ext?: string;
  note?: string;
  accessDenied?: boolean;
};

const MOCK_RULES: Rule[] = [
  { id: "user_temp", name: "用户临时文件", description: "当前用户与各软件产生的 Temp 目录垃圾", group: "system", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "sys_temp", name: "系统临时文件", description: "C:\\Windows\\Temp 下的系统级临时文件", group: "system", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "win_update_cache", name: "Windows 更新缓存", description: "已下载的更新安装包（SoftwareDistribution）", group: "system", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "delivery_opt", name: "传递优化缓存", description: "Windows 更新 P2P 分发缓存", group: "system", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "wer_reports", name: "错误报告与转储", description: "Windows 错误报告、崩溃转储与调试信息", group: "system", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "thumbnail_cache", name: "缩略图与图标缓存", description: "资源管理器的 thumbcache / iconcache", group: "system", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "recycle_bin", name: "回收站", description: "清空 C 盘回收站", group: "system", risk: "safe", requires_admin: false, default_enabled: true, special: "recycle_bin" },
  { id: "windows_old", name: "Windows.old 旧系统", description: "大版本升级残留的旧系统备份（约 20-40 GB）", group: "system", risk: "caution", requires_admin: true, default_enabled: false },
  { id: "nv_downloader", name: "NVIDIA 驱动安装包缓存", description: "GeForce 下载的驱动安装包（常达数 GB）", group: "driver", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "nv_installer2", name: "NVIDIA Installer2 暂存", description: "驱动安装过程的解包暂存文件", group: "driver", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "nv_shadowplay", name: "NVIDIA 录屏视频", description: "ShadowPlay / Instant Replay 保存的录屏（Videos 目录）", group: "game", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "nv_shader_cache", name: "NVIDIA 着色器缓存", description: "DXCache / GLCache 着色器编译缓存", group: "driver", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "amd_installer", name: "AMD 驱动解压目录", description: "C:\\AMD 下每次装驱动解压的安装文件", group: "driver", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "amd_shader_cache", name: "AMD 着色器缓存", description: "DxCache / Dx9Cache / GLCache", group: "driver", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "intel_extract", name: "Intel 驱动解压目录", description: "C:\\Intel 下的驱动解压文件", group: "driver", risk: "caution", requires_admin: true, default_enabled: false },
  { id: "package_cache", name: "Package Cache 安装器缓存", description: "各类软件安装框架缓存（删除后部分软件无法修复/卸载）", group: "driver", risk: "caution", requires_admin: true, default_enabled: false },
  { id: "edge_cache", name: "Edge 浏览器缓存", description: "页面缓存、Code Cache、GPU 缓存", group: "browser", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "chrome_cache", name: "Chrome 浏览器缓存", description: "页面缓存、Code Cache、GPU 缓存", group: "browser", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "firefox_cache", name: "Firefox 浏览器缓存", description: "cache2 页面缓存与启动缓存", group: "browser", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "downloads", name: "下载文件夹", description: "浏览器默认下载目录（你的个人文件，请确认后再清理）", group: "browser", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "recordings", name: "游戏录屏视频", description: "NVIDIA ShadowPlay / Xbox Game Bar 录制的视频", group: "game", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "ue_game_logs", name: "游戏日志与崩溃记录", description: "UE 引擎游戏的 Saved\\Logs 与 Saved\\Crashes", group: "game", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "game_crash_dumps", name: "游戏崩溃转储", description: "%LOCALAPPDATA%\\CrashDumps 下的 .dmp 文件", group: "game", risk: "safe", requires_admin: false, default_enabled: true },
  { id: "steam_logs", name: "Steam 日志与转储", description: "Steam 的 logs / dumps / crashdumps", group: "game", risk: "safe", requires_admin: true, default_enabled: true },
  { id: "wechat_cache", name: "微信文件缓存", description: "WeChat Files\\FileStorage\\cache（聊天图片视频缓存）", group: "chat", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "npm_cache", name: "npm 缓存", description: "%LOCALAPPDATA%\\npm-cache", group: "dev", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "pip_cache", name: "pip 缓存", description: "%LOCALAPPDATA%\\pip\\cache", group: "dev", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "gradle_cache", name: "Gradle 缓存", description: "~\\.gradle\\caches（删除后构建需重新下载依赖）", group: "dev", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "nuget_cache", name: "NuGet 包缓存", description: "~\\.nuget\\packages（删除后需重新还原）", group: "dev", risk: "caution", requires_admin: false, default_enabled: false },
  { id: "hiberfil", name: "休眠文件 hiberfil.sys", description: "缩小或关闭休眠文件（约等于内存容量的 40%-100%）", group: "advanced", risk: "advanced", requires_admin: true, default_enabled: false, special: "hiberfil" },
  { id: "winxsx", name: "WinSxS 组件存储清理", description: "通过系统 DISM 接口清理组件存储（安全，耗时数分钟）", group: "advanced", risk: "advanced", requires_admin: true, default_enabled: false, special: "winxsx" },
];

const MOCK_SPECS: Record<string, MockSpec> = {
  user_temp: { size: 5.6e9, count: 3842, namePool: ["tmp", "cab", "log", "dmp"] },
  sys_temp: { size: 1.2e9, count: 763, namePool: ["tmp", "log"] },
  win_update_cache: { size: 3.9e9, count: 214, namePool: ["cab", "psf", "dll"] },
  delivery_opt: { size: 0.8e9, count: 46, namePool: ["cab"] },
  wer_reports: { size: 0.42e9, count: 89, namePool: ["dmp", "wer", "txt"] },
  thumbnail_cache: { size: 0.31e9, count: 17, namePool: ["db"] },
  recycle_bin: { size: 2.3e9, count: 158, namePool: [] },
  windows_old: { size: 28.6e9, count: 91240, namePool: ["dll", "exe", "cat"] },
  nv_downloader: { size: 4.7e9, count: 6, namePool: ["exe"] },
  nv_installer2: { size: 1.9e9, count: 214, namePool: ["dll", "exe"] },
  nv_shadowplay: { size: 38.4e9, count: 42, namePool: ["mp4"] },
  nv_shader_cache: { size: 0.94e9, count: 1206, namePool: ["bin"] },
  amd_installer: { size: 2.1e9, count: 318, namePool: ["exe", "dll"] },
  amd_shader_cache: { size: 0.22e9, count: 341, namePool: ["bin"] },
  intel_extract: { size: 0.9e9, count: 96, namePool: ["exe", "dll", "inf"] },
  package_cache: { size: 6.8e9, count: 482, namePool: ["exe", "msi", "nupkg"] },
  edge_cache: { size: 2.1e9, count: 8214, namePool: ["bin", "js", "data_1"] },
  chrome_cache: { size: 1.4e9, count: 6311, namePool: ["bin", "js"] },
  firefox_cache: { size: 0.36e9, count: 1820, namePool: ["bin"] },
  downloads: { size: 21.7e9, count: 143, namePool: ["zip", "exe", "msi", "pdf", "7z", "iso"] },
  recordings: { size: 38.4e9, count: 42, namePool: ["mp4", "mkv"] },
  ue_game_logs: { size: 1.8e9, count: 236, namePool: ["log"] },
  game_crash_dumps: { size: 1.1e9, count: 12, namePool: ["dmp"] },
  steam_logs: { size: 0.28e9, count: 64, namePool: ["log", "dmp", "txt"] },
  wechat_cache: { size: 3.2e9, count: 5120, namePool: ["dat", "jpg", "mp4"] },
  npm_cache: { size: 4.2e9, count: 24310, namePool: ["tgz", "json"] },
  pip_cache: { size: 1.7e9, count: 4210, namePool: ["whl"] },
  gradle_cache: { size: 8.9e9, count: 41200, namePool: ["jar"] },
  nuget_cache: { size: 3.4e9, count: 9800, namePool: ["nupkg", "dll"] },
  hiberfil: { size: 25.8e9, count: 1, namePool: ["sys"] },
  winxsx: { size: 0, count: 0, namePool: [] },
};

const RECORDING_NAMES = [
  "Instant Replay 2026-08-27 21-43.mp4",
  "Instant Replay 2026-08-27 22-15.mp4",
  "黑神话悟空 2026-08-26 20-02.mp4",
  "Instant Replay 2026-08-25 19-48.mp4",
  "CS2 精彩集锦 2026-08-24.mp4",
  "Instant Replay 2026-08-23 23-31.mp4",
];

const DOWNLOAD_NAMES = [
  "Adobe_Photoshop_2026_Installer.exe",
  "ubuntu-24.04.3-desktop-amd64.iso",
  "dotnet-sdk-9.0.100-win-x64.exe",
  "腾讯会议_安装包.exe",
  "node-v25.4.0-x64.msi",
  "毕业旅行照片合集.7z",
  "cuda_12.6_windows.exe",
  "wallpaper_engine_素材包.zip",
];

const GAME_LOG_NAMES = [
  "BlackMyth.log",
  "BlackMyth-backup-2026-08-20.log",
  "CrashContext.runtime-9f2a.log",
  "game-bs-iw8-shipping.log",
  "StellarBlade-Crash-2026-08-12.dmp",
];

let seed = 42;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function makeFiles(spec: MockSpec, ruleId: string): FileEntry[] {
  const shown = Math.min(spec.count, 60);
  const files: FileEntry[] = [];
  for (let i = 0; i < shown; i++) {
    let name: string;
    if (ruleId === "recordings" || ruleId === "nv_shadowplay") {
      name = RECORDING_NAMES[i % RECORDING_NAMES.length];
    } else if (ruleId === "downloads") {
      name = DOWNLOAD_NAMES[i % DOWNLOAD_NAMES.length];
    } else if (ruleId === "ue_game_logs") {
      name = GAME_LOG_NAMES[i % GAME_LOG_NAMES.length];
    } else if (ruleId === "nv_downloader") {
      name = `${516 + i}.09_notebook-win10-win11-64bit-international-dch-whql.exe`;
    } else if (ruleId === "package_cache" || ruleId === "npm_cache") {
      name = `${spec.namePool[i % spec.namePool.length]}-${(rand() * 1e6) | 0}.${spec.namePool[i % spec.namePool.length]}`;
    } else {
      name = `${ruleId}_${(rand() * 1e6) | 0}.${spec.namePool[i % spec.namePool.length] ?? "tmp"}`;
    }
    const frac = spec.size > 0 ? (spec.size / spec.count) * (0.4 + rand() * 1.6) : 0;
    const daysAgo = rand() * 60;
    files.push({
      path: `C:\\模拟路径\\${ruleId}\\${name}`,
      size: Math.max(1024, Math.round(frac)),
      modified: Date.now() - daysAgo * 86400000,
    });
  }
  return files.sort((a, b) => b.size - a.size);
}

function mockScanResult(rule: Rule): RuleScanResult {
  const spec = MOCK_SPECS[rule.id];
  if (!spec) {
    return {
      rule_id: rule.id,
      total_size: 0,
      total_count: 0,
      files: [],
      truncated: false,
      access_denied: false,
    };
  }
  if (rule.special === "recycle_bin") {
    return {
      rule_id: rule.id,
      total_size: spec.size,
      total_count: spec.count,
      files: [],
      truncated: false,
      access_denied: false,
      note: `回收站内有 ${spec.count} 个项目，清理将直接清空 C 盘回收站。`,
    };
  }
  if (rule.special === "hiberfil") {
    return {
      rule_id: rule.id,
      total_size: spec.size,
      total_count: 1,
      files: [],
      truncated: false,
      access_denied: false,
      note: `当前休眠文件为 ${(spec.size / 1e9).toFixed(1)} GB。执行“缩小休眠文件”后约为内存的 40%，可释放约 ${(spec.size * 0.6 / 1e9).toFixed(1)} GB。`,
    };
  }
  if (rule.special === "winxsx") {
    return {
      rule_id: rule.id,
      total_size: 0,
      total_count: 0,
      files: [],
      truncated: false,
      access_denied: false,
      note: "将由系统 DISM 接口执行组件清理，通常可释放 1-5 GB，无法精确预估。执行耗时数分钟，期间请勿关机。",
    };
  }
  return {
    rule_id: rule.id,
    total_size: spec.size,
    total_count: spec.count,
    files: makeFiles(spec, rule.id),
    truncated: spec.count > 60,
    access_denied: rule.requires_admin && rule.id === "sys_temp",
  };
}

export function createMockBackend(): Backend {
  return {
    kind: "mock",
    async getRules() {
      await delay(150);
      return MOCK_RULES;
    },
    async scan(onProgress) {
      const started = Date.now();
      for (let i = 0; i < MOCK_RULES.length; i++) {
        const r = MOCK_RULES[i];
        onProgress({ index: i + 1, total: MOCK_RULES.length, rule_id: r.id, name: r.name });
        await delay(70 + rand() * 160);
      }
      const report: ScanReport = {
        drive: { total_bytes: 476.9e9, free_bytes: 189.3e9 },
        results: MOCK_RULES.map(mockScanResult),
        duration_ms: Date.now() - started,
        elevated: false,
      };
      return report;
    },
    async clean(ruleIds, _mode: DeleteMode, onProgress: (p: CleanProgress) => void) {
      await delay(400);
      let totalFreed = 0;
      const results = [];
      for (const id of ruleIds) {
        const rule = MOCK_RULES.find((r) => r.id === id);
        const res = mockScanResult(rule ?? MOCK_RULES[0]);
        onProgress({ rule_id: id, name: rule?.name ?? id, phase: "start", freed: 0, deleted: 0, failed: 0 });
        await delay(300 + rand() * 500);
        const errors =
          id === "thumbnail_cache"
            ? [{ path: "C:\\Users\\demo\\AppData\\Local\\Microsoft\\Windows\\Explorer\\thumbcache_256.db", reason: "文件被资源管理器占用" }]
            : [];
        const failed = errors.length;
        totalFreed += Math.max(0, res.total_size - 0.02e9);
        const item = {
          rule_id: id,
          freed: Math.max(0, res.total_size - 0.02e9),
          deleted: Math.max(0, res.total_count - failed),
          failed,
          errors,
          note: res.note ?? null,
        };
        results.push(item);
        onProgress({ rule_id: id, name: rule?.name ?? id, phase: "done", freed: item.freed, deleted: item.deleted, failed: item.failed });
      }
      const report: CleanReport = { total_freed: totalFreed, results };
      return report;
    },
    async driveInfo() {
      return { total_bytes: 476.9e9, free_bytes: 189.3e9 };
    },
    async elevated() {
      return false;
    },
    async openPath(_path: string) {
      console.info("[演示模式] 打开目录:", _path);
    },
  };
}

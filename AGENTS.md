# CSweeper 交接与调试指南（给 ZCode / 任何接手的 agent）

> 本项目由 ZCode 在 macOS 上开发于 2026-08-28，前端构建与 `cargo check`（rustc 1.93）已通过，
> **所有 Windows 专属代码路径未在真机验证过**。本文档是第一优先级阅读材料。

## 项目是什么

CSweeper（C盘清道夫）：Windows C 盘选择式清理工具。Tauri 2 + React 18 + TypeScript + Rust。
31 条清理规则（系统/驱动与显卡/浏览器/游戏与录屏/聊天/开发者/高级），风险三级分类，
默认删入回收站，特殊项（回收站/WinSxS/休眠文件）走系统接口而非删文件。

## 常用命令

```bash
npm install          # 前端依赖
npm run dev          # 浏览器演示模式（mock 数据，无需 Windows，右上角有"演示数据"徽标）
npx tauri dev        # Windows 真机调试（需要 Node 20+ 与 Rust stable）
npx tauri build      # 产出 exe：src-tauri/target/release/csweeper.exe（绿色版）
                     #        + bundle/nsis/*-setup.exe（安装包）
```

CI：push 到 GitHub 后 `.github/workflows/build-windows.yml` 自动出 exe（Actions → Artifacts 下载）。

## 代码地图

| 文件 | 职责 |
|---|---|
| `src-tauri/src/rules.rs` | **规则目录（产品核心）**：31 条规则的路径/通配/后缀/年龄过滤，改规则只动这里 |
| `src-tauri/src/scanner.rs` | 目录枚举 + 规则匹配（walkdir 不跟随 junction；globset 大小写不敏感；预览上限 2000） |
| `src-tauri/src/cleaner.rs` | 逐文件删除：`trash` crate（回收站）或 `remove_file`（永久）。**只删文件不删目录** |
| `src-tauri/src/special.rs` | 特殊项：Clear-RecycleBin / powercfg / DISM（非管理员时经 PowerShell `-Verb RunAs` 提权） |
| `src-tauri/src/util.rs` | %ENV% 展开、通配路径解析、**cfg(windows) 的 API 调用集中在这里** |
| `src-tauri/src/lib.rs` | Tauri 命令（get_rules/scan/clean/drive_info/open_path/is_elevated）+ 事件 |
| `src/` | React 前端；`api.ts` 自动切换真机/ mock；`mock/mockBackend.ts` 是演示数据 |

## 已验证 / 未验证

已验证（macOS）：`tsc + vite build` 通过；`cargo check` 零警告（tauri 2.11）；mock 模式全流程 UI（扫描→勾选→确认→清理→结果）。

**未验证（Windows 真机，debug 重点，按风险排序）：**

1. `util.rs::glob_paths` — `glob` crate 处理 `C:/...` 盘符绝对路径 + 通配符（如
   `%LOCALAPPDATA%\*\Saved\Logs`）在真机的行为。**症状：某些规则扫出 0。**
   若出问题：改用手动拆分父目录 + `read_dir` 匹配单层通配。
2. `util.rs::is_elevated` 已改为 `net session` 退出码检测——OpenProcessToken 在 windows-sys 0.59
   中模块路径不稳定（不在 Security/Foundation/Threading），CI 首跑 E0432 后移除。
   `drive_info`（GetDiskFreeSpaceExW）已通过 CI 的 MSVC 编译验证，运行时行为待真机确认。
3. `open_path` 的 `explorer /select,"path"` raw_arg 引号解析。
4. `special.rs` 的 PowerShell 命令 — Clear-RecycleBin 需 PowerShell 5+（Win10/11 自带）；
   `-Verb RunAs` 触发 UAC 后 DISM/powercfg 是否真正执行。
5. `trash` crate 在 Windows 的回收站行为（走 IFileOperation）；被占用文件（缩略图缓存）会失败属预期。
6. `PROGRAMFILES(X86)` 环境变量名大小写（std::env::var 在 Windows 不区分大小写，理论 OK）。

## 铁律（不许违反）

- 永不删除目录本身，只删匹配的文件
- 永不触碰 `C:\Windows\Installer`；WinSxS 只走 DISM `StartComponentCleanup`，绝不直接删文件
- 默认删除方式是回收站；回收站失败时**不做**永久删除兜底
- 清理前必须重新枚举（不能复用预览的截断列表）
- 谨慎/高级级规则 `default_enabled` 必须为 false

## 约定

- 界面文案中文；代码注释只在"代码本身说不清楚的约束"处写
- 修改清理规则 → 只改 `rules.rs` 的 `catalog()`，用 `spec/aged/exts/depth/exclude` 构造器
- 前端类型与后端 serde 字段一一对应（见 `src/types.ts`），改动需两侧同步
- 提交信息用中文，格式：`模块: 改了什么`

## 下一步计划（用户认可的方向）

微信 4.x（xwechat_files）缓存专项 → 重复文件检测（参考 Czkawka 三级过滤）→ MFT 直读加速 → 清理历史记录

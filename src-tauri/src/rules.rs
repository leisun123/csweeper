use serde::Serialize;

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Risk {
    Safe,
    Caution,
    Advanced,
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Group {
    System,
    Driver,
    Browser,
    Game,
    Chat,
    Dev,
    Advanced,
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Special {
    RecycleBin,
    Hiberfil,
    WinSxs,
}

pub struct PathSpec {
    pub base: String,
    pub include: Vec<String>,
    pub exclude: Vec<String>,
    pub extensions: Vec<String>,
    pub min_age_days: u64,
    pub max_depth: usize,
}

pub struct Rule {
    pub id: &'static str,
    pub name: String,
    pub description: String,
    pub group: Group,
    pub risk: Risk,
    pub requires_admin: bool,
    pub default_enabled: bool,
    pub special: Option<Special>,
    pub paths: Vec<PathSpec>,
}

impl Serialize for Rule {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut o = s.serialize_struct("Rule", 8)?;
        o.serialize_field("id", &self.id)?;
        o.serialize_field("name", &self.name)?;
        o.serialize_field("description", &self.description)?;
        o.serialize_field("group", &self.group)?;
        o.serialize_field("risk", &self.risk)?;
        o.serialize_field("requires_admin", &self.requires_admin)?;
        o.serialize_field("default_enabled", &self.default_enabled)?;
        o.serialize_field("special", &self.special)?;
        o.end()
    }
}

fn spec(base: &str, include: &[&str]) -> PathSpec {
    PathSpec {
        base: base.to_string(),
        include: include.iter().map(|s| s.to_string()).collect(),
        exclude: Vec::new(),
        extensions: Vec::new(),
        min_age_days: 0,
        max_depth: 12,
    }
}

fn aged(mut p: PathSpec, days: u64) -> PathSpec {
    p.min_age_days = days;
    p
}

fn exts(mut p: PathSpec, ext: &[&str]) -> PathSpec {
    p.extensions = ext.iter().map(|s| s.to_string()).collect();
    p
}

fn depth(mut p: PathSpec, d: usize) -> PathSpec {
    p.max_depth = d;
    p
}

fn exclude(mut p: PathSpec, patterns: &[&str]) -> PathSpec {
    p.exclude = patterns.iter().map(|s| s.to_string()).collect();
    p
}

fn rule(
    id: &'static str,
    name: &str,
    desc: &str,
    group: Group,
    risk: Risk,
    requires_admin: bool,
    paths: Vec<PathSpec>,
) -> Rule {
    Rule {
        id,
        name: name.to_string(),
        description: desc.to_string(),
        group,
        risk,
        requires_admin,
        default_enabled: risk == Risk::Safe,
        special: None,
        paths,
    }
}

fn special_rule(
    id: &'static str,
    name: &str,
    desc: &str,
    group: Group,
    risk: Risk,
    requires_admin: bool,
    sp: Special,
) -> Rule {
    Rule {
        id,
        name: name.to_string(),
        description: desc.to_string(),
        group,
        risk,
        requires_admin,
        default_enabled: risk == Risk::Safe,
        special: Some(sp),
        paths: Vec::new(),
    }
}

pub fn catalog() -> Vec<Rule> {
    use Group::{Advanced as GAdvanced, Browser, Chat, Dev, Driver, Game, System};
    use Risk::{Advanced, Caution, Safe};

    vec![
        // ---------- 系统垃圾 ----------
        rule(
            "user_temp",
            "用户临时文件",
            "当前用户与各软件产生的 Temp 目录垃圾",
            System,
            Safe,
            false,
            vec![aged(spec(r"%LOCALAPPDATA%\Temp", &["**"]), 1)],
        ),
        rule(
            "sys_temp",
            "系统临时文件",
            r"C:\Windows\Temp 下的系统级临时文件",
            System,
            Safe,
            true,
            vec![spec(r"C:\Windows\Temp", &["**"])],
        ),
        rule(
            "win_update_cache",
            "Windows 更新缓存",
            "已下载完成的更新安装包（SoftwareDistribution）",
            System,
            Safe,
            true,
            vec![spec(
                r"C:\Windows\SoftwareDistribution\Download",
                &["**"],
            )],
        ),
        rule(
            "delivery_opt",
            "传递优化缓存",
            "Windows 更新 P2P 分发缓存",
            System,
            Safe,
            true,
            vec![spec(
                r"C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache",
                &["**"],
            )],
        ),
        rule(
            "wer_reports",
            "错误报告与转储",
            "Windows 错误报告（WER）与调试转储",
            System,
            Safe,
            false,
            vec![
                spec(r"%PROGRAMDATA%\Microsoft\Windows\WER", &["ReportQueue/**", "ReportArchive/**", "Temp/**"]),
                spec(r"%LOCALAPPDATA%\Microsoft\Windows\WER", &["ReportQueue/**", "ReportArchive/**", "Temp/**"]),
            ],
        ),
        rule(
            "minidumps",
            "系统崩溃转储",
            "蓝屏 Minidump 与 MEMORY.DMP",
            System,
            Safe,
            true,
            vec![
                spec(r"C:\Windows\Minidump", &["**"]),
                PathSpec {
                    base: r"C:\Windows\MEMORY.DMP".to_string(),
                    ..spec("", &[])
                },
            ],
        ),
        rule(
            "thumbnail_cache",
            "缩略图与图标缓存",
            "资源管理器的 thumbcache / iconcache（被占用时本次跳过）",
            System,
            Safe,
            false,
            vec![depth(
                spec(
                    r"%LOCALAPPDATA%\Microsoft\Windows\Explorer",
                    &["thumbcache_*.db", "iconcache_*.db"],
                ),
                1,
            )],
        ),
        special_rule(
            "recycle_bin",
            "回收站",
            "清空 C 盘回收站",
            System,
            Safe,
            false,
            Special::RecycleBin,
        ),
        rule(
            "windows_old",
            "Windows.old 旧系统",
            "大版本升级残留的旧系统备份（约 20-40 GB）",
            System,
            Caution,
            true,
            vec![spec(r"C:\Windows.old", &["**"])],
        ),
        // ---------- 驱动与显卡 ----------
        rule(
            "nv_downloader",
            "NVIDIA 驱动安装包缓存",
            "GeForce Experience / App 下载的驱动安装包（常达数 GB）",
            Driver,
            Safe,
            true,
            vec![spec(r"%PROGRAMDATA%\NVIDIA Corporation\Downloader", &["**"])],
        ),
        rule(
            "nv_installer2",
            "NVIDIA Installer2 暂存",
            "驱动安装过程的解包暂存文件",
            Driver,
            Safe,
            true,
            vec![spec(r"%PROGRAMDATA%\NVIDIA Corporation\Installer2", &["**"])],
        ),
        rule(
            "nv_shader_cache",
            "NVIDIA 着色器缓存",
            "DXCache / GLCache / NV_Cache 着色器编译缓存",
            Driver,
            Safe,
            false,
            vec![
                spec(r"%LOCALAPPDATA%\NVIDIA\DXCache", &["**"]),
                spec(r"%LOCALAPPDATA%\NVIDIA\GLCache", &["**"]),
                spec(r"%LOCALAPPDATA%\NVIDIA Corporation\NV_Cache", &["**"]),
            ],
        ),
        rule(
            "dx_shader_cache",
            "DirectX 着色器缓存",
            r"%LOCALAPPDATA%\D3DSCache",
            Driver,
            Safe,
            false,
            vec![spec(r"%LOCALAPPDATA%\D3DSCache", &["**"])],
        ),
        rule(
            "amd_installer",
            "AMD 驱动解压目录",
            r"C:\AMD 下每次安装驱动解压的安装文件",
            Driver,
            Safe,
            true,
            vec![spec(r"C:\AMD", &["**"])],
        ),
        rule(
            "amd_shader_cache",
            "AMD 着色器缓存",
            "DxCache / Dx9Cache / GLCache",
            Driver,
            Safe,
            false,
            vec![
                spec(r"%LOCALAPPDATA%\AMD\DxCache", &["**"]),
                spec(r"%LOCALAPPDATA%\AMD\Dx9Cache", &["**"]),
                spec(r"%LOCALAPPDATA%\AMD\GLCache", &["**"]),
            ],
        ),
        rule(
            "intel_extract",
            "Intel 驱动解压目录",
            r"C:\Intel 下的驱动解压文件",
            Driver,
            Caution,
            true,
            vec![spec(r"C:\Intel", &["**"])],
        ),
        rule(
            "package_cache",
            "Package Cache 安装器缓存",
            "各类软件安装框架缓存（删除后部分软件将无法修复/卸载）",
            Driver,
            Caution,
            true,
            vec![spec(r"C:\ProgramData\Package Cache", &["**"])],
        ),
        // ---------- 浏览器 ----------
        rule(
            "edge_cache",
            "Edge 浏览器缓存",
            "页面缓存、Code Cache、GPU 缓存、Service Worker 缓存",
            Browser,
            Safe,
            false,
            vec![spec(
                r"%LOCALAPPDATA%\Microsoft\Edge\User Data\*",
                &[
                    "Cache/**",
                    "Code Cache/**",
                    "GPUCache/**",
                    "Service Worker/CacheStorage/**",
                    "Service Worker/ScriptCache/**",
                ],
            )],
        ),
        rule(
            "chrome_cache",
            "Chrome 浏览器缓存",
            "页面缓存、Code Cache、GPU 缓存、Service Worker 缓存",
            Browser,
            Safe,
            false,
            vec![spec(
                r"%LOCALAPPDATA%\Google\Chrome\User Data\*",
                &[
                    "Cache/**",
                    "Code Cache/**",
                    "GPUCache/**",
                    "Service Worker/CacheStorage/**",
                    "Service Worker/ScriptCache/**",
                ],
            )],
        ),
        rule(
            "firefox_cache",
            "Firefox 浏览器缓存",
            "cache2 页面缓存与启动缓存",
            Browser,
            Safe,
            false,
            vec![spec(
                r"%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*",
                &["cache2/**", "startupCache/**", "thumbnails/**"],
            )],
        ),
        rule(
            "downloads",
            "下载文件夹",
            "浏览器默认下载目录（你的个人文件，请确认后再清理）",
            Browser,
            Caution,
            false,
            vec![exclude(
                spec(r"%USERPROFILE%\Downloads", &["**"]),
                &["desktop.ini"],
            )],
        ),
        // ---------- 游戏与录屏 ----------
        rule(
            "recordings",
            "游戏录屏视频",
            "NVIDIA ShadowPlay / Instant Replay / Xbox Game Bar 录制的视频（Videos 目录）",
            Game,
            Caution,
            false,
            vec![aged(
                exts(
                    depth(spec(r"%USERPROFILE%\Videos", &["**"]), 3),
                    &["mp4", "mkv", "flv", "avi", "mov"],
                ),
                7,
            )],
        ),
        rule(
            "ue_game_logs",
            "游戏日志与崩溃记录",
            r"UE 引擎游戏的 Saved\logs 与 Saved\Crashes",
            Game,
            Safe,
            false,
            vec![
                spec(r"%LOCALAPPDATA%\*\Saved\Logs", &["**"]),
                spec(r"%LOCALAPPDATA%\*\Saved\Crashes", &["**"]),
            ],
        ),
        rule(
            "game_crash_dumps",
            "游戏崩溃转储",
            r"%LOCALAPPDATA%\CrashDumps 下的 .dmp 文件",
            Game,
            Safe,
            false,
            vec![exts(spec(r"%LOCALAPPDATA%\CrashDumps", &["**"]), &["dmp", "mdmp", "hdmp"])],
        ),
        rule(
            "steam_logs",
            "Steam 日志与转储",
            "Steam 的 logs / dumps / crashdumps",
            Game,
            Safe,
            true,
            vec![
                spec(r"%PROGRAMFILES(X86)%\Steam\logs", &["**"]),
                spec(r"%PROGRAMFILES(X86)%\Steam\dumps", &["**"]),
                spec(r"%PROGRAMFILES(X86)%\Steam\crashdumps", &["**"]),
            ],
        ),
        // ---------- 聊天工具 ----------
        rule(
            "wechat_cache",
            "微信文件缓存",
            r"WeChat Files\各账号\FileStorage\cache（聊天图片视频缓存，不含聊天记录）",
            Chat,
            Caution,
            false,
            vec![spec(
                r"%USERPROFILE%\Documents\WeChat Files\*",
                &["FileStorage/cache/**", "FileStorage/video_cache/**"],
            )],
        ),
        // ---------- 开发者缓存 ----------
        rule(
            "npm_cache",
            "npm 缓存",
            r"%LOCALAPPDATA%\npm-cache（删除后安装需重新下载）",
            Dev,
            Caution,
            false,
            vec![spec(r"%LOCALAPPDATA%\npm-cache", &["**"])],
        ),
        rule(
            "pip_cache",
            "pip 缓存",
            r"%LOCALAPPDATA%\pip\Cache",
            Dev,
            Caution,
            false,
            vec![spec(r"%LOCALAPPDATA%\pip\Cache", &["**"])],
        ),
        rule(
            "gradle_cache",
            "Gradle 缓存",
            r"~\.gradle\caches（删除后构建需重新下载依赖）",
            Dev,
            Caution,
            false,
            vec![spec(r"%USERPROFILE%\.gradle\caches", &["**"])],
        ),
        rule(
            "nuget_cache",
            "NuGet 包缓存",
            r"~\.nuget\packages（删除后需重新还原）",
            Dev,
            Caution,
            false,
            vec![spec(r"%USERPROFILE%\.nuget\packages", &["**"])],
        ),
        // ---------- 高级系统项 ----------
        special_rule(
            "hiberfil",
            "休眠文件 hiberfil.sys",
            "缩小休眠文件至内存的约 40%（不删除文件，执行 powercfg）",
            GAdvanced,
            Advanced,
            true,
            Special::Hiberfil,
        ),
        special_rule(
            "winxsx",
            "WinSxS 组件存储清理",
            "通过系统 DISM 接口清理组件存储（安全，耗时数分钟）",
            GAdvanced,
            Advanced,
            true,
            Special::WinSxs,
        ),
    ]
}

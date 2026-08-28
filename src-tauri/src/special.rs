use crate::cleaner::{CleanError, CleanRuleResult};
use crate::rules::Special;
use crate::scanner::RuleScanResult;

fn human(n: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut v = n as f64;
    let mut i = 0;
    while v >= 1024.0 && i < UNITS.len() - 1 {
        v /= 1024.0;
        i += 1;
    }
    if i == 0 {
        format!("{n} B")
    } else {
        format!("{v:.1} {}", UNITS[i])
    }
}

fn system_drive() -> String {
    std::env::var("SYSTEMDRIVE").unwrap_or_else(|_| "C:".into())
}

pub fn scan_special(rule_id: &str, sp: Special) -> RuleScanResult {
    match sp {
        Special::RecycleBin => scan_recycle_bin(rule_id),
        Special::Hiberfil => scan_hiberfil(rule_id),
        Special::WinSxs => scan_winxsx(rule_id),
    }
}

fn scan_recycle_bin(rule_id: &str) -> RuleScanResult {
    let mut res = RuleScanResult {
        rule_id: rule_id.to_string(),
        ..Default::default()
    };
    let bin = format!(r"{}\$Recycle.Bin", system_drive());
    for entry in walkdir::WalkDir::new(&bin)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
    {
        match entry {
            Ok(en) => {
                if !en.file_type().is_file() {
                    continue;
                }
                if let Ok(md) = en.metadata() {
                    res.total_size += md.len();
                    res.total_count += 1;
                }
            }
            Err(err) => {
                if let Some(io) = err.io_error() {
                    if io.kind() == std::io::ErrorKind::PermissionDenied {
                        res.access_denied = true;
                    }
                }
            }
        }
    }
    res.note = Some(format!(
        "回收站内有 {} 个项目，共 {}。清理将直接清空{}盘回收站（清空后无法再还原）。",
        res.total_count,
        human(res.total_size),
        system_drive().trim_end_matches(':')
    ));
    res
}

fn scan_hiberfil(rule_id: &str) -> RuleScanResult {
    let mut res = RuleScanResult {
        rule_id: rule_id.to_string(),
        ..Default::default()
    };
    let path = format!(r"{}\hiberfil.sys", system_drive());
    match std::fs::metadata(&path) {
        Ok(md) => {
            res.total_size = md.len();
            res.total_count = 1;
            res.note = Some(format!(
                "当前休眠文件为 {}。执行“开始清理”将运行 powercfg /h /type reduced，把休眠文件缩小到内存的约 40%，预计释放约 {}。",
                human(md.len()),
                human(md.len() * 6 / 10)
            ));
        }
        Err(e) => {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                res.access_denied = true;
                res.note = Some("无法读取休眠文件大小（需要管理员权限）。".to_string());
            } else {
                res.note = Some("未找到休眠文件（休眠可能已关闭），无需处理。".to_string());
            }
        }
    }
    res
}

fn scan_winxsx(rule_id: &str) -> RuleScanResult {
    RuleScanResult {
        rule_id: rule_id.to_string(),
        note: Some(
            "将由系统 DISM 接口执行组件清理（StartComponentCleanup），通常可释放 1-5 GB，无法精确预估。执行耗时数分钟且在后台运行，期间请勿关机。".to_string(),
        ),
        ..Default::default()
    }
}

pub fn clean_special(rule_id: &str, sp: Special) -> CleanRuleResult {
    match sp {
        Special::RecycleBin => clean_recycle_bin(rule_id),
        Special::Hiberfil => clean_hiberfil(rule_id),
        Special::WinSxs => clean_winxsx(rule_id),
    }
}

fn clean_recycle_bin(rule_id: &str) -> CleanRuleResult {
    let mut r = CleanRuleResult {
        rule_id: rule_id.to_string(),
        ..Default::default()
    };
    let scan = scan_recycle_bin(rule_id);
    let drive = system_drive().trim_end_matches(':').to_string();
    let cmd = format!("Clear-RecycleBin -DriveLetter {drive} -Force -ErrorAction SilentlyContinue");
    match run_powershell(&cmd) {
        Ok(()) => {
            r.freed = scan.total_size;
            r.deleted = scan.total_count;
            r.note = Some(format!("已清空 {drive}: 盘回收站。"));
        }
        Err(e) => {
            r.failed = 1;
            r.errors.push(CleanError {
                path: format!("{drive}:\\$Recycle.Bin"),
                reason: format!("Clear-RecycleBin 执行失败：{e}"),
            });
        }
    }
    r
}

fn clean_hiberfil(rule_id: &str) -> CleanRuleResult {
    let mut r = CleanRuleResult {
        rule_id: rule_id.to_string(),
        ..Default::default()
    };
    let run = if crate::util::is_elevated() {
        std::process::Command::new("powercfg")
            .args(["/h", "/type", "reduced"])
            .output()
            .map(|o| if o.status.success() { Ok(()) } else { Err(format!("exit code {}", o.status)) })
            .map_err(|e| e.to_string())
            .and_then(|x| x)
    } else {
        run_powershell(
            "Start-Process -Verb RunAs -FilePath 'powercfg' -ArgumentList '/h','/type','reduced'",
        )
    };
    match run {
        Ok(()) => {
            r.note = Some(
                "已执行 powercfg /h /type reduced。休眠文件将缩小到内存的约 40%（快速启动仍可用）。".to_string(),
            );
        }
        Err(e) => {
            r.failed = 1;
            r.errors.push(CleanError {
                path: "hiberfil.sys".to_string(),
                reason: format!("powercfg 执行失败：{e}"),
            });
        }
    }
    r
}

fn clean_winxsx(rule_id: &str) -> CleanRuleResult {
    let mut r = CleanRuleResult {
        rule_id: rule_id.to_string(),
        ..Default::default()
    };
    let run = if crate::util::is_elevated() {
        std::process::Command::new("Dism.exe")
            .args(["/Online", "/Cleanup-Image", "/StartComponentCleanup"])
            .spawn()
            .map(|_| Ok(()))
            .map_err(|e| e.to_string())
            .and_then(|x| x)
    } else {
        run_powershell(
            "Start-Process -Verb RunAs -FilePath 'Dism.exe' -ArgumentList '/Online','/Cleanup-Image','/StartComponentCleanup'",
        )
    };
    match run {
        Ok(()) => {
            r.note = Some(
                "DISM 组件清理已启动（后台运行，可在任务管理器查看 Dism.exe）。释放量请稍后在“此电脑”查看。".to_string(),
            );
        }
        Err(e) => {
            r.failed = 1;
            r.errors.push(CleanError {
                path: "WinSxS".to_string(),
                reason: format!("DISM 启动失败：{e}"),
            });
        }
    }
    r
}

fn run_powershell(cmd: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", cmd])
            .output()
            .map_err(|e| e.to_string())?;
        // Clear-RecycleBin 等命令即使成功也可能返回非零，这里只看是否成功启动
        if out.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
        Err("仅支持 Windows".to_string())
    }
}

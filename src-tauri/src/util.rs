use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize, Clone)]
pub struct DriveInfo {
    pub total_bytes: u64,
    pub free_bytes: u64,
}

/// 展开 %VAR% 形式的环境变量；未定义的变量原样保留（后续 glob 不命中即跳过）。
pub fn expand_env(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '%' {
            if let Some(off) = chars[i + 1..].iter().position(|&c| c == '%') {
                let name: String = chars[i + 1..i + 1 + off].iter().collect();
                if let Ok(v) = std::env::var(&name) {
                    out.push_str(&v);
                    i += off + 2;
                    continue;
                }
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

/// 展开通配符路径。无通配符时退化为 exists 检查，避免 glob 对盘符路径的差异行为。
pub fn glob_paths(pattern: &str) -> Vec<PathBuf> {
    let norm = pattern.replace('\\', "/");
    let has_wild = norm.contains('*') || norm.contains('?') || norm.contains('[');
    if !has_wild {
        let p = PathBuf::from(&norm);
        return if p.exists() { vec![p] } else { vec![] };
    }
    match glob::glob(&norm) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => Vec::new(),
    }
}

/// 提权检测：`net session` 只有管理员能成功返回。
/// 不用 OpenProcessToken 是因为该函数在 windows-sys 各版本模块路径不稳定
/// （0.59 中不在 Security/Foundation/Threading），CI 实测 E0432。
#[cfg(windows)]
pub fn is_elevated() -> bool {
    use std::sync::OnceLock;
    static ELEVATED: OnceLock<bool> = OnceLock::new();
    *ELEVATED.get_or_init(|| {
        std::process::Command::new("net")
            .arg("session")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

#[cfg(windows)]
pub fn drive_info() -> Result<DriveInfo, String> {
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let drive = std::env::var("SYSTEMDRIVE").unwrap_or_else(|_| "C:".into());
    let root = format!("{drive}\\");
    let wide: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();
    let (mut free, mut total, mut total_free) = (0u64, 0u64, 0u64);
    let ok = unsafe {
        GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, &mut total, &mut total_free)
    };
    if ok != 0 {
        Ok(DriveInfo { total_bytes: total, free_bytes: free })
    } else {
        Err(format!("无法读取 {root} 磁盘信息"))
    }
}

#[cfg(not(windows))]
pub fn drive_info() -> Result<DriveInfo, String> {
    Err("仅支持 Windows".to_string())
}

pub fn open_path(path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{path}\""))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

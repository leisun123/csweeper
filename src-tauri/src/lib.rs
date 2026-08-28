mod cleaner;
mod rules;
mod scanner;
mod special;
mod util;

use serde::Serialize;
use tauri::Emitter;

#[derive(Serialize, Clone)]
pub struct ScanReport {
    pub drive: util::DriveInfo,
    pub results: Vec<scanner::RuleScanResult>,
    pub duration_ms: u64,
    pub elevated: bool,
}

#[derive(Serialize, Clone)]
pub struct CleanReport {
    pub total_freed: u64,
    pub results: Vec<cleaner::CleanRuleResult>,
}

#[derive(Serialize, Clone)]
struct ScanProgressPayload {
    index: usize,
    total: usize,
    rule_id: String,
    name: String,
}

#[derive(Serialize, Clone)]
struct CleanProgressPayload {
    rule_id: String,
    name: String,
    phase: &'static str,
    freed: u64,
    deleted: u64,
    failed: u64,
}

#[tauri::command]
fn get_rules() -> Vec<rules::Rule> {
    rules::catalog()
}

#[tauri::command]
fn is_elevated() -> bool {
    util::is_elevated()
}

#[tauri::command]
fn drive_info() -> Result<util::DriveInfo, String> {
    util::drive_info()
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    util::open_path(&path)
}

#[tauri::command]
async fn scan(app: tauri::AppHandle) -> Result<ScanReport, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<ScanReport, String> {
        let started = std::time::Instant::now();
        let cat = rules::catalog();
        let mut results = Vec::with_capacity(cat.len());
        for (i, r) in cat.iter().enumerate() {
            let _ = app.emit(
                "scan-progress",
                ScanProgressPayload {
                    index: i + 1,
                    total: cat.len(),
                    rule_id: r.id.to_string(),
                    name: r.name.clone(),
                },
            );
            results.push(scanner::scan_rule(r));
        }
        Ok(ScanReport {
            drive: util::drive_info()?,
            results,
            duration_ms: started.elapsed().as_millis() as u64,
            elevated: util::is_elevated(),
        })
    })
    .await
    .map_err(|e| format!("扫描线程错误: {e}"))?
}

#[tauri::command]
async fn clean(
    app: tauri::AppHandle,
    ids: Vec<String>,
    mode: cleaner::DeleteMode,
) -> Result<CleanReport, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<CleanReport, String> {
        let cat = rules::catalog();
        let mut results = Vec::new();
        let mut total_freed = 0u64;
        for id in &ids {
            let r = cat
                .iter()
                .find(|r| r.id == *id)
                .ok_or_else(|| format!("未知规则: {id}"))?;
            let _ = app.emit(
                "clean-progress",
                CleanProgressPayload {
                    rule_id: id.clone(),
                    name: r.name.clone(),
                    phase: "start",
                    freed: 0,
                    deleted: 0,
                    failed: 0,
                },
            );
            let done = cleaner::clean_rule(r, mode);
            total_freed += done.freed;
            let _ = app.emit(
                "clean-progress",
                CleanProgressPayload {
                    rule_id: id.clone(),
                    name: r.name.clone(),
                    phase: "done",
                    freed: done.freed,
                    deleted: done.deleted,
                    failed: done.failed,
                },
            );
            results.push(done);
        }
        Ok(CleanReport { total_freed, results })
    })
    .await
    .map_err(|e| format!("清理线程错误: {e}"))?
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_rules,
            is_elevated,
            drive_info,
            open_path,
            scan,
            clean
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

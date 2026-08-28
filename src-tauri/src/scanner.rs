use crate::rules::{PathSpec, Rule};
use crate::util;
use globset::GlobSet;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize, Clone, Default)]
pub struct RuleScanResult {
    pub rule_id: String,
    pub total_size: u64,
    pub total_count: u64,
    pub files: Vec<FileEntry>,
    pub truncated: bool,
    pub access_denied: bool,
    pub error: Option<String>,
    pub note: Option<String>,
}

pub struct FileHit {
    pub path: PathBuf,
    pub size: u64,
    pub modified: SystemTime,
}

pub const PREVIEW_CAP: usize = 2000;

pub fn scan_rule(rule: &Rule) -> RuleScanResult {
    if let Some(sp) = rule.special {
        return crate::special::scan_special(rule.id, sp);
    }
    let mut res = RuleScanResult {
        rule_id: rule.id.to_string(),
        ..Default::default()
    };
    for spec in &rule.paths {
        let (hits, denied) = collect_spec(spec);
        res.access_denied |= denied;
        for h in hits {
            res.total_size += h.size;
            res.total_count += 1;
            if res.files.len() < PREVIEW_CAP {
                res.files.push(FileEntry {
                    path: h.path.to_string_lossy().into_owned(),
                    size: h.size,
                    modified: systime_to_ms(h.modified),
                });
            } else {
                res.truncated = true;
            }
        }
    }
    res
}

/// 枚举一个 PathSpec 命中的所有文件。返回 (命中文件, 是否遇到权限拒绝)。
/// 只枚举文件、不删除；目录结构永不被改动。
pub fn collect_spec(spec: &PathSpec) -> (Vec<FileHit>, bool) {
    let mut hits = Vec::new();
    let mut denied = false;
    let expanded = util::expand_env(&spec.base);
    let include = build_globset(&spec.include);
    let exclude = build_globset(&spec.exclude);
    let age = min_age(spec.min_age_days);

    for base in util::glob_paths(&expanded) {
        let meta = match fs::symlink_metadata(&base) {
            Ok(m) => m,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    denied = true;
                }
                continue;
            }
        };
        if !meta.is_dir() {
            if let Ok(md) = fs::metadata(&base) {
                let modified = md.modified().ok();
                if include.is_empty()
                    && ext_ok(&spec.extensions, &base)
                    && age_ok(age, modified)
                {
                    hits.push(FileHit {
                        path: base.clone(),
                        size: md.len(),
                        modified: modified.unwrap_or(SystemTime::UNIX_EPOCH),
                    });
                }
            }
            continue;
        }
        for entry in walkdir::WalkDir::new(&base)
            .max_depth(spec.max_depth)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                rel_of(e.path(), &base).map(|r| !exclude.is_match(&r)).unwrap_or(true)
            })
        {
            match entry {
                Ok(en) => {
                    if !en.file_type().is_file() {
                        continue;
                    }
                    let Some(rel) = rel_of(en.path(), &base) else {
                        continue;
                    };
                    if !include.is_empty() && !include.is_match(&rel) {
                        continue;
                    }
                    if !ext_ok(&spec.extensions, en.path()) {
                        continue;
                    }
                    let Ok(md) = en.metadata() else {
                        continue;
                    };
                    let modified = md.modified().ok();
                    if !age_ok(age, modified) {
                        continue;
                    }
                    hits.push(FileHit {
                        path: en.path().to_path_buf(),
                        size: md.len(),
                        modified: modified.unwrap_or(SystemTime::UNIX_EPOCH),
                    });
                }
                Err(err) => {
                    if let Some(io) = err.io_error() {
                        if io.kind() == std::io::ErrorKind::PermissionDenied {
                            denied = true;
                        }
                    }
                }
            }
        }
    }
    (hits, denied)
}

fn rel_of(p: &Path, base: &Path) -> Option<String> {
    p.strip_prefix(base)
        .ok()
        .map(|r| r.to_string_lossy().replace('\\', "/"))
}

fn build_globset(patterns: &[String]) -> GlobSet {
    let mut b = globset::GlobSetBuilder::new();
    for p in patterns {
        if let Ok(g) = globset::GlobBuilder::new(p)
            .literal_separator(true)
            .case_insensitive(true)
            .build()
        {
            b.add(g);
        }
    }
    b.build().unwrap_or_default()
}

fn ext_ok(spec_exts: &[String], path: &Path) -> bool {
    if spec_exts.is_empty() {
        return true;
    }
    match path.extension().and_then(|e| e.to_str()) {
        Some(e) => spec_exts.iter().any(|x| x.eq_ignore_ascii_case(e)),
        None => false,
    }
}

fn min_age(days: u64) -> Option<Duration> {
    if days == 0 {
        None
    } else {
        Some(Duration::from_secs(days * 86_400))
    }
}

fn age_ok(age: Option<Duration>, modified: Option<SystemTime>) -> bool {
    match (age, modified) {
        (None, _) => true,
        (Some(a), Some(m)) => m.elapsed().map(|d| d >= a).unwrap_or(false),
        (Some(_), None) => false,
    }
}

fn systime_to_ms(t: SystemTime) -> u64 {
    t.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

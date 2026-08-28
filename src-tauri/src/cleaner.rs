use crate::rules::Rule;
use crate::scanner;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeleteMode {
    Recycle,
    Permanent,
}

#[derive(Serialize, Clone)]
pub struct CleanError {
    pub path: String,
    pub reason: String,
}

#[derive(Serialize, Clone, Default)]
pub struct CleanRuleResult {
    pub rule_id: String,
    pub freed: u64,
    pub deleted: u64,
    pub failed: u64,
    pub errors: Vec<CleanError>,
    pub note: Option<String>,
}

/// 清理单条规则：按同样的规则重新枚举（避免预览截断漏删），逐文件删除。
/// 只删文件不删目录；回收站模式失败时不做永久删除兜底，保证安全。
pub fn clean_rule(rule: &Rule, mode: DeleteMode) -> CleanRuleResult {
    if let Some(sp) = rule.special {
        return crate::special::clean_special(rule.id, sp);
    }
    let mut r = CleanRuleResult {
        rule_id: rule.id.to_string(),
        freed: 0,
        deleted: 0,
        failed: 0,
        errors: Vec::new(),
        note: None,
    };
    let mut hits = Vec::new();
    for spec in &rule.paths {
        let (h, _) = scanner::collect_spec(spec);
        hits.extend(h);
    }
    for h in hits {
        let res: Result<(), Box<dyn std::error::Error>> = match mode {
            DeleteMode::Recycle => trash::delete(&h.path).map_err(|e| Box::new(e) as _),
            DeleteMode::Permanent => std::fs::remove_file(&h.path).map_err(|e| Box::new(e) as _),
        };
        match res {
            Ok(()) => {
                r.freed += h.size;
                r.deleted += 1;
            }
            Err(e) => {
                r.failed += 1;
                if r.errors.len() < 100 {
                    r.errors.push(CleanError {
                        path: h.path.to_string_lossy().into_owned(),
                        reason: e.to_string(),
                    });
                }
            }
        }
    }
    r
}

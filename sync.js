// ============================================================================
//  前后端同步 — 把 localStorage 数据与 /api/state(KV) 双向同步。
//  localStorage 仍是本地缓存,后端为唯一真相源。
//  未配置后端(404/500/网络异常)时静默失败并回退 localStorage,不影响使用。
// ============================================================================

const SYNC_API = '/api/state';
// 键名与 shared.js 的 KEY_* 常量保持一致(shared.js 先于本文件加载)
const SYNC_KEYS = [KEY_START, KEY_INITIAL_V1, KEY_INITIAL_V2, KEY_ACTIVE_VERSION];

async function syncLoad() {
  try {
    const res = await fetch(SYNC_API, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    let changed = false;
    for (const k of SYNC_KEYS) {
      if (data[k] != null) { localStorage.setItem(k, data[k]); changed = true; }
    }
    return changed;
  } catch (e) {
    return false;
  }
}

async function syncPush() {
  try {
    const payload = {};
    for (const k of SYNC_KEYS) payload[k] = localStorage.getItem(k);
    const res = await fetch(SYNC_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

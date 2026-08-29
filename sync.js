// ============================================================================
//  前后端同步 — 把 localStorage 的三份数据 与 /api/state(KV) 双向同步。
//  localStorage 仍是本地缓存,后端为唯一真相源。
//  未配置后端(接口 404/500/网络异常)时静默失败并回退 localStorage,不影响使用。
//  注意:三份数据在 localStorage 中本就是字符串(names/changes 为 JSON 字符串),
//  故 payload 直接取原始字符串,后端原样存;拉取时直接 setItem 回原字符串,不再二次 stringify。
// ============================================================================

const SYNC_API = '/api/state';

async function syncLoad() {
  try {
    const res = await fetch(SYNC_API, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.semesterStart) localStorage.setItem('seat-semester-start', data.semesterStart);
    if (data.names)         localStorage.setItem('seat-student-names', data.names);
    if (data.changes)       localStorage.setItem('seat-arrangement-changes', data.changes);
    return true;
  } catch (e) {
    return false;
  }
}

async function syncPush() {
  try {
    const payload = {
      semesterStart: localStorage.getItem('seat-semester-start'),
      names:         localStorage.getItem('seat-student-names'),
      changes:       localStorage.getItem('seat-arrangement-changes'),
    };
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

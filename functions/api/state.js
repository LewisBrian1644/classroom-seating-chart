// ============================================================================
//  Cloudflare Pages Function — 座位表后端存储(KV)
//  路由: /api/state   GET 读取 / PUT 写入
//  依赖 Cloudflare 后台把 KV 命名空间绑定为变量名 SEATS。
//  共享状态(学期开始日期 / 初始座位表 V1 / V2 / 激活版本)以单个 key "state" 整体读写。
// ============================================================================

const KEYS = ['seat-semester-start', 'seat-initial-v1', 'seat-initial-v2', 'seat-active-version'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  try {
    const raw = await context.env.SEATS.get('state');
    if (!raw) return json({});
    return json(JSON.parse(raw));
  } catch (e) {
    return json({ error: 'read failed' }, 500);
  }
}

export async function onRequestPut(context) {
  try {
    const body = await context.request.json();
    // 只允许写入白名单内的键,防止脏数据
    const clean = {};
    for (const k of KEYS) {
      if (body[k] != null) clean[k] = String(body[k]);
    }
    await context.env.SEATS.put('state', JSON.stringify(clean));
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'write failed' }, 500);
  }
}

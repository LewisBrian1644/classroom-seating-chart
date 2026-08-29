// ============================================================================
//  Cloudflare Pages Function — 座位表后端存储(KV)
//  路由: /api/state   GET 读取 / PUT 写入
//  依赖 Cloudflare 后台把 KV 命名空间绑定为变量名 SEATS。
//  三份共享状态(学期开始日期 / 学生姓名 / 换座记录)以单个 key "state" 整体读写。
// ============================================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  try {
    const raw = await context.env.SEATS.get('state');
    if (!raw) return json({ semesterStart: null, names: null, changes: null });
    return json(JSON.parse(raw));
  } catch (e) {
    return json({ error: 'read failed' }, 500);
  }
}

export async function onRequestPut(context) {
  try {
    const body = await context.request.json();
    await context.env.SEATS.put('state', JSON.stringify(body));
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'write failed' }, 500);
  }
}

/**
 * support-poll
 * Returns agent messages for a cid after a timestamp.
 *
 * Two modes:
 *  - If Supabase env vars exist: reads from support_messages table (persistent).
 *  - Else: reads from in-memory inbox (for quick testing).
 */
const inbox = globalThis.__MSAI_INBOX__ || (globalThis.__MSAI_INBOX__ = new Map());

async function supabaseFetch(cid, since) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  // support_messages schema: id uuid, cid text, direction text, text text, created_at timestamptz default now()
  const endpoint =
    `${url}/rest/v1/support_messages?select=created_at,text&cid=eq.${encodeURIComponent(cid)}&direction=eq.agent&order=created_at.asc`;

  const rows = await fetch(endpoint, {
    headers: { "apikey": key, "authorization": `Bearer ${key}` }
  }).then(r=>r.json());

  const msgs = [];
  for (const r of rows || []) {
    const ts = new Date(r.created_at).getTime();
    if (ts > since) msgs.push({ ts, text: r.text });
  }
  return msgs;
}

export default async (request, context) => {
  try {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    const url = new URL(request.url);
    const cid = (url.searchParams.get("cid") || "").trim();
    const since = parseInt(url.searchParams.get("since") || "0", 10) || 0;

    if (!cid) return new Response(JSON.stringify({ ok:false, error:"Missing cid" }), { status: 400, headers: { "content-type":"application/json" }});

    const sb = await supabaseFetch(cid, since);
    if (sb !== null) {
      return new Response(JSON.stringify({ ok:true, messages: sb }), { status: 200, headers: { "content-type":"application/json" }});
    }

    // fallback memory
    const list = inbox.get(cid) || [];
    const fresh = list.filter(m => (m.ts || 0) > since);
    return new Response(JSON.stringify({ ok:true, messages: fresh }), { status: 200, headers: { "content-type":"application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e?.message || e) }), {
      status: 500, headers: { "content-type":"application/json" }
    });
  }
};

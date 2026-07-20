/**
 * support-send
 * Receives client message and forwards to Telegram group.
 * Also stores it (optional) to Supabase if env vars are provided.
 */
async function supabaseInsert(direction, cid, text) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  // table: support_messages (create if you want persistence)
  const endpoint = `${url}/rest/v1/support_messages`;
  const payload = [{ cid, direction, text }];
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": key,
      "authorization": `Bearer ${key}`,
      "prefer": "return=minimal"
    },
    body: JSON.stringify(payload)
  });
}

export default async (request, context) => {
  try {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const body = await request.json();
    const cid = (body?.cid || "").toString().trim();
    const text = (body?.text || "").toString().trim();
    const page = (body?.page || "").toString().trim();

    if (!cid || !text) {
      return new Response(JSON.stringify({ ok:false, error:"Missing cid/text" }), { status: 400, headers: { "content-type": "application/json" }});
    }

    // Accept both uppercase and lowercase env var names (Netlify keys are case-sensitive).
    // Recommended: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.telegram_bot_token;
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.telegram_chat_id;
    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok:false, error:"Missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID" }), { status: 500, headers: { "content-type":"application/json" }});
    }

    const msg = `🟢 Mickey Smart AI Support\nCID: ${cid}\nPage: ${page}\n\nClient: ${text}\n\nReply here by either:\n1) Reply to this message\nor\n2) /reply ${cid} your message`;
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type":"application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg })
    }).then(r=>r.json()).catch(()=>({ ok:false }));

    await supabaseInsert("client", cid, text);

    return new Response(JSON.stringify({ ok: true, telegram_ok: !!tg.ok }), {
      status: 200, headers: { "content-type":"application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e?.message || e) }), {
      status: 500, headers: { "content-type":"application/json" }
    });
  }
};

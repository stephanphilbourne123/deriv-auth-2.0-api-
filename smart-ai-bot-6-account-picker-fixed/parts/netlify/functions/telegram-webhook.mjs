/**
 * telegram-webhook
 * Captures replies from your Telegram group and routes them back to the correct client CID.
 *
 * Supports:
 *  A) Reply-to-message: you reply to the bot's message that contains "CID: <cid>"
 *  B) Command: /reply <cid> message
 *
 * Stores agent replies:
 *  - Supabase (if configured)
 *  - else in-memory inbox for quick testing
 */
const inbox = globalThis.__MSAI_INBOX__ || (globalThis.__MSAI_INBOX__ = new Map());

function pushMem(cid, text) {
  const ts = Date.now();
  const arr = inbox.get(cid) || [];
  arr.push({ ts, text });
  inbox.set(cid, arr);
}

async function supabaseInsert(cid, text) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const endpoint = `${url}/rest/v1/support_messages`;
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type":"application/json",
      "apikey": key,
      "authorization": `Bearer ${key}`,
      "prefer": "return=minimal"
    },
    body: JSON.stringify([{ cid, direction: "agent", text }])
  });
  return true;
}

function extractCIDFromText(t) {
  const m = /CID:\s*([a-f0-9]{12,64})/i.exec(t || "");
  return m ? m[1] : null;
}

export default async (request, context) => {
  try {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const update = await request.json();
    const msg = update?.message || update?.edited_message;
    const text = (msg?.text || "").trim();
    if (!text) return new Response(JSON.stringify({ ok:true, ignored:true }), { status: 200, headers: { "content-type":"application/json" }});

    let cid = null;
    let body = null;

    // Command /reply CID message...
    if (text.startsWith("/reply")) {
      const parts = text.split(" ");
      cid = (parts[1] || "").trim();
      body = parts.slice(2).join(" ").trim();
    } else if (msg?.reply_to_message?.text) {
      // Reply to the original bot message that contains CID
      cid = extractCIDFromText(msg.reply_to_message.text);
      body = text;
    }

    if (!cid || !body) {
      return new Response(JSON.stringify({ ok:true, ignored:true }), { status: 200, headers: { "content-type":"application/json" }});
    }

    const stored = await supabaseInsert(cid, body);
    if (!stored) pushMem(cid, body);

    return new Response(JSON.stringify({ ok:true, cid }), { status: 200, headers: { "content-type":"application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e?.message || e) }), {
      status: 500, headers: { "content-type":"application/json" }
    });
  }
};

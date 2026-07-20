// OAuth TOKEN EXCHANGE — server-side step of Deriv's OAuth 2.0 + PKCE flow.
//
// Deriv's *new* OAuth system (apps registered at developers.deriv.com, with an
// alphanumeric client_id like `33wk6T0W5ZsXYqjz3eY90`) uses the standard
// Authorization Code + PKCE flow:
//   1. Browser redirects to https://auth.deriv.com/oauth2/auth (see the
//      startDerivOAuth() function in app/index.html).
//   2. Deriv redirects back to /deriv/callback with ?code=...&state=...
//   3. This function exchanges that code (+ the original code_verifier) for
//      an access_token by calling Deriv's token endpoint. This MUST happen
//      server-side — Deriv's docs explicitly say never do this from the browser.
//
// This is a different system from the older `oauth.deriv.com/oauth2/authorize`
// flow (numeric app_id, tokens appended directly to the redirect URL). Do not
// mix the two — this app's client_id is only valid with the new flow below.

const DERIV_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';
const DEFAULT_CLIENT_ID = '33wk6T0W5ZsXYqjz3eY90';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const code = payload.code;
  const codeVerifier = payload.code_verifier;
  const redirectUri = payload.redirect_uri;

  if (!code || !codeVerifier || !redirectUri) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing code, code_verifier, or redirect_uri' })
    };
  }

  const clientId = process.env.DERIV_APP_ID || DEFAULT_CLIENT_ID;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri
  });

  try {
    const resp = await fetch(DERIV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { error: 'invalid_response', raw: text }; }

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          error: json.error || 'token_exchange_failed',
          error_description: json.error_description || 'Deriv rejected the code exchange.'
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        access_token: json.access_token,
        token_type: json.token_type || 'Bearer',
        expires_in: json.expires_in || null
      })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: 'network_error', error_description: String(err && err.message || err) })
    };
  }
};

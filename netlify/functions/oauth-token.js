/**
 * OAuth TOKEN EXCHANGE — server-side step of Deriv's OAuth 2.0 + PKCE flow.
 *
 * Deriv's *new* OAuth system uses the standard Authorization Code + PKCE flow:
 *   1. Browser redirects to https://auth.deriv.com/oauth2/auth
 *   2. Deriv redirects back to /deriv/callback with ?code=...&state=...
 *   3. This function exchanges that code (+ the original code_verifier) for
 *      an access_token by calling Deriv's token endpoint. This MUST happen
 *      server-side — Deriv's docs explicitly say never do this from the browser.
 */

const https = require('https');

function exchangeCodeForToken(code, codeVerifier, redirectUri) {
  return new Promise((resolve, reject) => {
    const clientId = process.env.DERIV_CLIENT_ID || '33wk6T0W5ZsXYqjz3eY90';

    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri
    });

    const options = {
      hostname: 'auth.deriv.com',
      port: 443,
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload.toString())
      }
    };

    console.log('🔄 Exchanging authorization code for access token...');
    console.log('Client ID:', clientId ? '✅ present' : '❌ MISSING');
    console.log('Code:', code.substring(0, 10) + '...');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Token exchange response:', Object.keys(parsed));
          if (parsed.access_token) {
            console.log('✅ Access token received!');
          } else if (parsed.error) {
            console.error('❌ Deriv error:', parsed.error, parsed.error_description);
          }
          resolve(parsed);
        } catch (e) {
          console.error('❌ JSON parse error:', e.message);
          reject(new Error('Invalid JSON from Deriv: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(payload.toString());
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('\n========== OAUTH TOKEN EXCHANGE START ==========');
  console.log('Method:', event.httpMethod);
  console.log('Timestamp:', new Date().toISOString());

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const { code, code_verifier, redirect_uri } = body;

  if (!code || !code_verifier || !redirect_uri) {
    console.error('❌ Missing required parameters');
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'missing_params',
        message: 'code, code_verifier, and redirect_uri are required'
      })
    };
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code, code_verifier, redirect_uri);

    // Check for errors from Deriv
    if (tokenResponse.error) {
      console.error('❌ Token exchange failed:', tokenResponse.error);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: tokenResponse.error,
          error_description: tokenResponse.error_description || 'Token exchange failed'
        })
      };
    }

    if (!tokenResponse.access_token) {
      console.error('❌ No access token in response');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'invalid_response',
          message: 'Deriv did not return an access token'
        })
      };
    }

    console.log('✅ Token exchange successful!');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      body: JSON.stringify({
        success: true,
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type || 'Bearer',
        expires_in: tokenResponse.expires_in || null
      })
    };

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'server_error',
        message: error.message || 'Token exchange failed'
      })
    };
  }
};

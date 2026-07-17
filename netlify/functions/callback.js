/**
 * Deriv OAuth 2.0 Callback Handler
 * This function processes the OAuth redirect from Deriv and exchanges code for token
 */

const https = require('https');
const { URL } = require('url');

function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    });

    const options = {
      hostname: 'oauth.deriv.com',
      port: 443,
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    console.log('Exchanging code for token at:', options.hostname + options.path);

    const req = https.request(options, (res) => {
      console.log('Token exchange response status:', res.statusCode);
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Token exchange response length:', data.length);
        try {
          const parsed = JSON.parse(data);
          console.log('Token exchange successful');
          resolve(parsed);
        } catch (e) {
          console.error('JSON parse error:', e.message);
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('=== CALLBACK FUNCTION START ===');
  console.log('Method:', event.httpMethod);
  console.log('Query params:', event.queryStringParameters);

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const { code, error, error_description } = event.queryStringParameters || {};

  if (error) {
    console.error(`[Deriv OAuth Error] ${error}: ${error_description}`);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error,
        message: error_description || 'OAuth authorization failed'
      })
    };
  }

  if (!code) {
    console.error('[Deriv OAuth Error] No authorization code received');
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'missing_code',
        message: 'No authorization code in callback'
      })
    };
  }

  try {
    console.log('Received code:', code.substring(0, 10) + '...');

    const clientId = process.env.DERIV_CLIENT_ID;
    const clientSecret = process.env.DERIV_CLIENT_SECRET;
    const redirectUri = process.env.DERIV_REDIRECT_URI || 'https://mickeysmartaibot.netlify.app/.netlify/functions/callback';

    console.log('Client ID:', !!clientId ? 'present' : 'MISSING');
    console.log('Client Secret:', !!clientSecret ? 'present' : 'MISSING');

    if (!clientId || !clientSecret) {
      console.error('Missing Deriv credentials');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'server_error',
          message: 'Server configuration error'
        })
      };
    }

    console.log('Exchanging authorization code for access token...');
    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    if (tokenResponse.error) {
      console.error('Token exchange error:', tokenResponse.error);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: tokenResponse.error,
          message: tokenResponse.error_description || 'Failed to exchange code for token'
        })
      };
    }

    console.log('Token exchange successful!');
    console.log('Access token received:', tokenResponse.access_token ? tokenResponse.access_token.substring(0, 20) + '...' : 'MISSING');

    // Redirect to app with token
    const appUrl = `https://mickeysmartaibot.netlify.app/app/selector.html?token=${encodeURIComponent(tokenResponse.access_token)}&expires_in=${tokenResponse.expires_in || 86400}`;

    return {
      statusCode: 302,
      headers: {
        'Location': appUrl,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: 'Redirecting with token' })
    };
  } catch (error) {
    console.error('[Callback Error]', error.message);
    console.error('Stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'server_error',
        message: error.message
      })
    };
  }
};

/**
 * Deriv OAuth 2.0 Callback Handler
 * This function processes the OAuth redirect from Deriv and exchanges code for PAT token
 */

const https = require('https');

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
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'NodeJS-Client'
      }
    };

    console.log('=== TOKEN EXCHANGE START ===');
    console.log('Exchanging code for token');
    console.log('Hostname:', options.hostname);
    console.log('Path:', options.path);
    console.log('Code length:', code.length);

    const req = https.request(options, (res) => {
      console.log('Token exchange response status:', res.statusCode);
      console.log('Response headers:', JSON.stringify(res.headers));
      
      let data = '';

      res.on('data', (chunk) => {
        console.log('Received chunk:', chunk.length, 'bytes');
        data += chunk;
      });

      res.on('end', () => {
        console.log('Total response data:', data.length, 'bytes');
        console.log('First 300 chars:', data.substring(0, 300));
        
        try {
          const parsed = JSON.parse(data);
          console.log('Successfully parsed JSON');
          console.log('Response keys:', Object.keys(parsed));
          resolve(parsed);
        } catch (e) {
          console.error('JSON parse error:', e.message);
          reject(new Error(`Invalid JSON: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Token exchange timeout'));
    });

    console.log('Writing payload...');
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('=== CALLBACK FUNCTION START ===');
  console.log('Method:', event.httpMethod);
  console.log('Path:', event.path);
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
    console.log('Received code:', code.substring(0, 15) + '...');

    const clientId = process.env.DERIV_CLIENT_ID;
    const clientSecret = process.env.DERIV_CLIENT_SECRET;
    const redirectUri = process.env.DERIV_REDIRECT_URI || 'https://mickeysmartaibot.netlify.app/.netlify/functions/callback';

    console.log('Environment check:');
    console.log('- Client ID present:', !!clientId);
    console.log('- Client Secret present:', !!clientSecret);
    console.log('- Redirect URI:', redirectUri);

    if (!clientId || !clientSecret) {
      console.error('Missing Deriv OAuth credentials');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'server_error',
          message: 'Missing Deriv OAuth credentials in environment'
        })
      };
    }

    console.log('Starting token exchange...');
    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    console.log('Token response received');
    
    if (tokenResponse.error) {
      console.error('Deriv error in response:', tokenResponse.error);
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

    console.log('Token exchange SUCCESS!');
    console.log('Access token:', tokenResponse.access_token ? tokenResponse.access_token.substring(0, 20) + '...' : 'MISSING');
    console.log('Token type:', tokenResponse.token_type);
    console.log('Expires in:', tokenResponse.expires_in);

    // Redirect to app with access token (PAT)
    const appUrl = `https://mickeysmartaibot.netlify.app/app/selector.html?token=${encodeURIComponent(tokenResponse.access_token)}&token_type=${tokenResponse.token_type || 'Bearer'}&expires_in=${tokenResponse.expires_in || 86400}`;

    console.log('Redirecting to:', appUrl.substring(0, 100) + '...');

    return {
      statusCode: 302,
      headers: {
        'Location': appUrl,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: 'Redirecting with access token' })
    };
  } catch (error) {
    console.error('[Callback Error]', error.message);
    console.error('Error stack:', error.stack);
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

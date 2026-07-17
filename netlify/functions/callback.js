/**
 * Deriv OAuth 2.0 Callback Handler
 * This function processes the OAuth redirect from Deriv and exchanges code for access token
 * Then redirects back to deriv-login.html with the token in URL parameters
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
        'User-Agent': 'Netlify-Function'
      }
    };

    console.log('=== TOKEN EXCHANGE REQUEST ===');
    console.log('Hostname:', options.hostname);
    console.log('Path:', options.path);
    console.log('Code:', code.substring(0, 10) + '...');

    const req = https.request(options, (res) => {
      console.log('Response Status:', res.statusCode);
      console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
      
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Response Body Length:', data.length);
        console.log('Response Body (first 500 chars):', data.substring(0, 500));
        
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Successfully parsed JSON response');
          console.log('Response keys:', Object.keys(parsed));
          resolve(parsed);
        } catch (e) {
          console.error('❌ JSON Parse Error:', e.message);
          console.error('Raw response:', data);
          reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      console.error('Error code:', error.code);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('❌ Request Timeout');
      req.destroy();
      reject(new Error('Token exchange request timeout'));
    });

    console.log('Sending payload...');
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('\n========== CALLBACK HANDLER START ==========');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Path:', event.path);
  console.log('Query String Parameters:', event.queryStringParameters);
  console.log('Timestamp:', new Date().toISOString());

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    console.warn('❌ Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const queryParams = event.queryStringParameters || {};
  const { code, error, error_description, state } = queryParams;

  console.log('OAuth Response:');
  console.log('- Code:', code ? code.substring(0, 15) + '...' : 'MISSING');
  console.log('- Error:', error || 'none');
  console.log('- State:', state);

  // Handle OAuth error response
  if (error) {
    console.error('❌ OAuth Error from Deriv:', error, error_description);
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

  // Check for authorization code
  if (!code) {
    console.error('❌ No authorization code received');
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'missing_code',
        message: 'No authorization code provided by Deriv'
      })
    };
  }

  try {
    console.log('\n--- Environment Setup ---');
    
    const clientId = process.env.DERIV_CLIENT_ID;
    const clientSecret = process.env.DERIV_CLIENT_SECRET;
    const redirectUri = process.env.DERIV_REDIRECT_URI || 'https://mickeysmartaibot.netlify.app/.netlify/functions/callback';

    console.log('Client ID:', clientId ? '✅ present' : '❌ MISSING');
    console.log('Client Secret:', clientSecret ? '✅ present' : '❌ MISSING');
    console.log('Redirect URI:', redirectUri);

    // Validate credentials
    if (!clientId || !clientSecret) {
      console.error('❌ Missing Deriv OAuth credentials in environment variables');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'server_error',
          message: 'Server OAuth credentials not configured'
        })
      };
    }

    console.log('\n--- Starting Token Exchange ---');
    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    console.log('\n--- Token Exchange Response ---');
    
    // Check for errors in token response
    if (tokenResponse.error) {
      console.error('❌ Token Exchange Error:', tokenResponse.error);
      console.error('Error Description:', tokenResponse.error_description);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: tokenResponse.error,
          message: tokenResponse.error_description || 'Failed to exchange authorization code for token'
        })
      };
    }

    // Validate access token
    if (!tokenResponse.access_token) {
      console.error('❌ No access token in response');
      console.error('Response:', tokenResponse);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'invalid_response',
          message: 'No access token received from Deriv'
        })
      };
    }

    console.log('✅ Token Exchange SUCCESS!');
    console.log('Access Token:', tokenResponse.access_token.substring(0, 20) + '...');
    console.log('Token Type:', tokenResponse.token_type || 'Bearer');
    console.log('Expires In:', tokenResponse.expires_in || 'unknown');
    console.log('Scope:', tokenResponse.scope || 'read write');

    // Build redirect URL back to deriv-login.html with token
    const loginPageUrl = new URL('https://mickeysmartaibot.netlify.app/app/deriv-login.html');
    loginPageUrl.searchParams.set('token', tokenResponse.access_token);
    loginPageUrl.searchParams.set('token_type', tokenResponse.token_type || 'Bearer');
    if (tokenResponse.expires_in) {
      loginPageUrl.searchParams.set('expires_in', tokenResponse.expires_in);
    }

    console.log('\n--- Redirecting Back ---');
    console.log('Redirect URL:', loginPageUrl.toString().substring(0, 100) + '...');

    return {
      statusCode: 302,
      headers: {
        'Location': loginPageUrl.toString(),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Token exchanged successfully. Redirecting...' 
      })
    };

  } catch (error) {
    console.error('\n❌ CALLBACK ERROR');
    console.error('Error Message:', error.message);
    console.error('Error Type:', error.constructor.name);
    console.error('Stack Trace:', error.stack);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'server_error',
        message: error.message || 'An error occurred during OAuth callback processing',
        timestamp: new Date().toISOString()
      })
    };
  }
};

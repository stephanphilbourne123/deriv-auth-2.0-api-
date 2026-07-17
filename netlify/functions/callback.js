/**
 * Deriv OAuth 2.0 Callback Handler
 * This function processes the OAuth redirect from Deriv and exchanges code for access token
 * Then redirects back to homepage with the token
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

  if (error) {
    console.error('❌ OAuth Error from Deriv:', error, error_description);
    return {
      statusCode: 302,
      headers: {
        'Location': '/?oauth_error=' + encodeURIComponent(error),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: ''
    };
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return {
      statusCode: 302,
      headers: {
        'Location': '/?oauth_error=missing_code',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: ''
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

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Deriv OAuth credentials in environment variables');
      return {
        statusCode: 302,
        headers: {
          'Location': '/?oauth_error=server_error',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: ''
      };
    }

    console.log('\n--- Starting Token Exchange ---');
    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    console.log('\n--- Token Exchange Response ---');
    
    if (tokenResponse.error) {
      console.error('❌ Token Exchange Error:', tokenResponse.error);
      console.error('Error Description:', tokenResponse.error_description);
      return {
        statusCode: 302,
        headers: {
          'Location': '/?oauth_error=' + encodeURIComponent(tokenResponse.error),
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: ''
      };
    }

    if (!tokenResponse.access_token) {
      console.error('❌ No access token in response');
      console.error('Response:', tokenResponse);
      return {
        statusCode: 302,
        headers: {
          'Location': '/?oauth_error=invalid_response',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: ''
      };
    }

    console.log('✅ Token Exchange SUCCESS!');
    console.log('Access Token:', tokenResponse.access_token.substring(0, 20) + '...');
    console.log('Token Type:', tokenResponse.token_type || 'Bearer');
    console.log('Expires In:', tokenResponse.expires_in || 'unknown');

    // Redirect to homepage with token in URL so it can be saved
    const homeUrl = new URL('https://mickeysmartaibot.netlify.app/');
    homeUrl.searchParams.set('token', tokenResponse.access_token);
    homeUrl.searchParams.set('token_type', tokenResponse.token_type || 'Bearer');
    if (tokenResponse.expires_in) {
      homeUrl.searchParams.set('expires_in', tokenResponse.expires_in);
    }

    console.log('\n--- Redirecting Back to Homepage ---');
    console.log('Redirect URL:', homeUrl.toString().substring(0, 100) + '...');

    return {
      statusCode: 302,
      headers: {
        'Location': homeUrl.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: ''
    };

  } catch (error) {
    console.error('\n❌ CALLBACK ERROR');
    console.error('Error Message:', error.message);
    console.error('Error Type:', error.constructor.name);
    console.error('Stack Trace:', error.stack);

    return {
      statusCode: 302,
      headers: {
        'Location': '/?oauth_error=server_error',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: ''
    };
  }
};

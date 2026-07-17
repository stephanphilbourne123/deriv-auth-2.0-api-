const https = require('https');

function makeDerivRequest(payload, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.deriv.com',
      port: 443,
      path: '/api/v3',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`,
        'Deriv-App-ID': '33wk6T0W5ZsXYqjz3eY90'
      }
    };

    console.log('🔌 Connecting to Deriv API...');
    
    const req = https.request(options, (res) => {
      console.log('📨 Response status:', res.statusCode);
      
      let data = '';
      
      res.on('data', (chunk) => { 
        data += chunk; 
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Valid JSON received');
          resolve(parsed);
        } catch (e) {
          console.error('❌ JSON Parse Error:', e.message);
          console.error('Raw response:', data.substring(0, 500));
          reject(new Error(`Invalid JSON from Deriv: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request Error:', err.message);
      reject(err);
    });

    req.on('timeout', () => {
      console.error('❌ Request Timeout');
      req.destroy();
      reject(new Error('Deriv API timeout'));
    });
    
    req.setTimeout(30000);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('=== AUTHORIZE FUNCTION START ===');
  console.log('Method:', event.httpMethod);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get token from Authorization header
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    console.log('🔑 Auth header received:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No Authorization header');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authorization header is required' })
      };
    }

    // Extract token from "Bearer TOKEN"
    const token = authHeader.replace('Bearer ', '').trim();
    console.log('🔑 Token extracted, length:', token.length);
    
    if (!token) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Token is required' })
      };
    }

    console.log('🚀 Making authorize request to Deriv...');
    const authResponse = await makeDerivRequest({ authorize: 1 }, token);
    console.log('✅ Auth response received');

    if (authResponse.error) {
      console.error('❌ Deriv API Error:', authResponse.error.message);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: authResponse.error.message })
      };
    }

    console.log('✅ Authorization successful! User ID:', authResponse.authorize?.user_id);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        authorize: authResponse.authorize
      })
    };
  } catch (error) {
    console.error('❌ Authorization error:', error.message);
    console.error('Stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

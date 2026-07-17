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

    console.log('Making request to Deriv API with bearer token');
    console.log('Headers:', {
      'Authorization': 'Bearer [token]',
      'Deriv-App-ID': options.headers['Deriv-App-ID'],
      'Content-Type': 'application/json'
    });
    
    const req = https.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      
      let data = '';
      
      res.on('data', (chunk) => { 
        data += chunk; 
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON from Deriv: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Deriv API timeout'));
    });
    
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
        'Access-Control-Allow-Headers': 'Content-Type',
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
    const body = JSON.parse(event.body || '{}');
    const { token } = body;
    
    console.log('Token received:', !!token);
    
    if (!token) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Token is required' })
      };
    }

    console.log('Making request to Deriv...');
    const authResponse = await makeDerivRequest({ authorize: 1 }, token);
    console.log('Auth response received');

    if (authResponse.error) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: authResponse.error.message })
      };
    }

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
    console.error('Authorization error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

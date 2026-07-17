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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Valid JSON received');
          resolve(parsed);
        } catch (e) {
          console.error('❌ JSON Parse Error:', e.message);
          console.error('Raw response:', data.substring(0, 500));
          reject(new Error(`Invalid JSON from Deriv: ${data.substring(0, 100)}`));
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
  console.log('=== BALANCE FUNCTION START ===');
  console.log('Event body:', event.body);

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
    const token = body.token;
    const loginid = body.loginid;
    
    console.log('🔑 Token received:', !!token);
    console.log('📏 Token length:', token ? token.length : 0);
    console.log('👤 LoginID:', loginid);
    
    if (!token || !loginid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Token and loginid are required' })
      };
    }

    console.log('🚀 Requesting balance from Deriv...');
    const balanceResponse = await makeDerivRequest({
      balance: 1,
      loginid: loginid
    }, token);

    console.log('✅ Balance response received');

    if (balanceResponse.error) {
      console.error('❌ Deriv API Error:', balanceResponse.error);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: balanceResponse.error.message })
      };
    }

    console.log('✅ Balance fetched:', balanceResponse.balance?.balance, balanceResponse.balance?.currency);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        balance: balanceResponse.balance
      })
    };
  } catch (error) {
    console.error('❌ Balance error:', error.message);
    console.error('Stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

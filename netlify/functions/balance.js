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

    console.log('Fetching balance from Deriv API');
    console.log('Headers: Authorization: Bearer [token], Deriv-App-ID: 33wk6T0W5ZsXYqjz3eY90');

    const req = https.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON from Deriv: ${data.substring(0, 100)}`));
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
  console.log('=== BALANCE FUNCTION START ===');

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
    const { token, loginid } = body;
    
    console.log('Token received:', !!token);
    console.log('LoginID:', loginid);
    
    if (!token || !loginid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Token and loginid are required' })
      };
    }

    console.log('Requesting balance for account:', loginid);
    const balanceResponse = await makeDerivRequest({
      balance: 1,
      loginid: loginid
    }, token);

    console.log('Balance response received');

    if (balanceResponse.error) {
      console.error('Error from Deriv:', balanceResponse.error);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: balanceResponse.error.message })
      };
    }

    console.log('Balance retrieved:', balanceResponse.balance?.balance, balanceResponse.balance?.currency);

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
    console.error('Balance error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

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

    console.log('Fetching accounts from Deriv API');
    console.log('Headers:', {
      'Authorization': 'Bearer [token]',
      'Deriv-App-ID': options.headers['Deriv-App-ID'],
      'Content-Type': 'application/json'
    });

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
  console.log('=== ACCOUNTS FUNCTION START ===');

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

    console.log('Requesting account list...');
    const accountsResponse = await makeDerivRequest({
      account_list: 1
    }, token);

    console.log('Account list response received');

    if (accountsResponse.error) {
      console.error('Error from Deriv:', accountsResponse.error);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: accountsResponse.error.message })
      };
    }

    console.log('Accounts found:', accountsResponse.account_list?.length || 0);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        account_list: accountsResponse.account_list || []
      })
    };
  } catch (error) {
    console.error('Accounts error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

const https = require('https');

function makeDerivRequest(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.deriv.com',
      port: 443,
      path: '/api/v3',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + data));
        }
      });
    });

    req.on('error', (error) => { reject(error); });
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const { token } = JSON.parse(event.body || '{}');
    
    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token is required' })
      };
    }

    console.log('Fetching account list...');
    const accountsResponse = await makeDerivRequest({
      authorize: token,
      account_list: 1
    });
    console.log('Accounts response:', accountsResponse);

    if (accountsResponse.error) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: accountsResponse.error.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        account_list: accountsResponse.account_list || []
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

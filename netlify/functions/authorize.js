const https = require('https');
const http = require('http');
const { URL } = require('url');

function makeDerivRequest(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const url = new URL('https://api.deriv.com/api/v3');
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'NodeJS-Client'
      }
    };

    console.log('Making HTTPS request to:', url.href);
    
    const req = https.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      let data = '';
      
      res.on('data', (chunk) => { 
        data += chunk; 
      });
      
      res.on('end', () => {
        console.log('Response data length:', data.length);
        console.log('First 200 chars:', data.substring(0, 200));
        
        try {
          const parsed = JSON.parse(data);
          console.log('Successfully parsed JSON');
          resolve(parsed);
        } catch (e) {
          console.error('JSON parse error:', e.message);
          reject(new Error(`Invalid JSON from Deriv: ${data.substring(0, 200)}`));
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
      reject(new Error('Deriv API timeout'));
    });
    
    console.log('Writing payload:', JSON.stringify(payload).substring(0, 100) + '...');
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event, context) => {
  console.log('=== AUTHORIZE FUNCTION START ===');
  console.log('Method:', event.httpMethod);
  console.log('Path:', event.path);

  // Handle OPTIONS requests for CORS
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS request');
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
    console.log('Parsing request body...');
    const body = JSON.parse(event.body || '{}');
    const { token } = body;
    
    console.log('Token received:', !!token);
    console.log('Token length:', token ? token.length : 0);
    
    if (!token) {
      console.error('No token provided');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Token is required' })
      };
    }

    console.log('Making request to Deriv with token...');
    const authResponse = await makeDerivRequest({ authorize: token });
    console.log('Auth response received successfully');

    if (authResponse.error) {
      console.error('Deriv error:', authResponse.error);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: authResponse.error.message })
      };
    }

    console.log('Authorization successful');
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
    console.error('Stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

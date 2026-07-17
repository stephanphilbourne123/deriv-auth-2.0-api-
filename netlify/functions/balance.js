const WebSocket = require('ws');

exports.handler = async (event, context) => {
  console.log('=== BALANCE FUNCTION START ===');
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
    
    // Get loginid from body
    const body = JSON.parse(event.body || '{}');
    const loginid = body.loginid;
    console.log('👤 LoginID:', loginid);
    
    if (!token || !loginid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authorization header and loginid are required' })
      };
    }

    console.log('🚀 Connecting to Deriv WebSocket for balance...');
    
    const result = await getBalanceWithWebSocket(token, loginid);
    
    if (!result.success) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: result.error })
      };
    }

    console.log('✅ Balance fetched successfully!');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        balance: result.data
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

function getBalanceWithWebSocket(token, loginid) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.derivws.com/websockets/v3');
    let balanceData = null;
    let authorized = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket balance request timeout'));
    }, 10000);

    ws.on('open', () => {
      console.log('📡 WebSocket connected');
      // Send authorize message first
      ws.send(JSON.stringify({ authorize: token }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📨 WebSocket message:', JSON.stringify(message).slice(0, 200));
        
        if (message.authorize && !authorized) {
          authorized = true;
          console.log('✅ Authorized, requesting balance for', loginid);
          // Now request balance
          ws.send(JSON.stringify({ 
            balance: 1,
            loginid: loginid,
            req_id: 1
          }));
        } else if (message.balance) {
          balanceData = message.balance;
          console.log('✅ Balance data received');
          ws.close();
          clearTimeout(timeout);
          resolve({ success: true, data: message.balance });
        } else if (message.error) {
          console.error('❌ Error:', message.error);
          ws.close();
          clearTimeout(timeout);
          resolve({ success: false, error: message.error });
        }
      } catch (e) {
        console.error('❌ Message parse error:', e.message);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      console.log('📡 WebSocket closed');
      clearTimeout(timeout);
      if (!balanceData && authorized) {
        reject(new Error('WebSocket closed without receiving balance'));
      }
    });
  });
}

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

    console.log('🚀 Calling balance via fetch to Deriv API...');
    
    // Use fetch instead of WebSocket to avoid ws dependency
    const derivResponse = await fetch('https://ws.derivws.com/websockets/v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        authorize: token,
        balance: 1,
        loginid: loginid
      })
    });

    const responseText = await derivResponse.text();
    console.log('📨 Response status:', derivResponse.status);

    if (!derivResponse.ok) {
      console.error('❌ Deriv API returned non-ok status');
      return {
        statusCode: derivResponse.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Deriv balance request failed',
          derivStatus: derivResponse.status,
          derivResponse: responseText.slice(0, 500)
        })
      };
    }

    let derivData;
    try {
      derivData = JSON.parse(responseText);
      console.log('✅ Valid JSON received');
    } catch (e) {
      console.error('❌ JSON Parse Error:', e.message);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Deriv returned a non-JSON response',
          derivResponse: responseText.slice(0, 500)
        })
      };
    }

    if (derivData.error) {
      console.error('❌ Deriv API Error:', derivData.error.message || derivData.error);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: derivData.error.message || derivData.error })
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
        balance: derivData.balance || derivData
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

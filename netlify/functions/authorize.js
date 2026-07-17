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

    console.log('🚀 Making GET request to Deriv API...');
    
    const derivResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Deriv-App-ID': '33wk6T0W5ZsXYqjz3eY90',
        'Accept': 'application/json'
      },
      redirect: 'manual'
    });

    console.log('📨 Response status:', derivResponse.status);
    
    const responseText = await derivResponse.text();
    console.log('📄 Response text length:', responseText.length);

    // Check for redirects
    if (derivResponse.status >= 300 && derivResponse.status < 400) {
      console.error('❌ Deriv returned redirect');
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Deriv endpoint redirected',
          derivStatus: derivResponse.status,
          derivLocation: derivResponse.headers.get('location')
        })
      };
    }

    if (!derivResponse.ok) {
      console.error('❌ Deriv API returned non-ok status');
      return {
        statusCode: derivResponse.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Deriv authorize request failed',
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
          derivStatus: derivResponse.status,
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

    console.log('✅ Authorization successful!');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        authorize: derivData
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

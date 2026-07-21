exports.handler = async (event, context) => {
  console.log('=== ACCOUNTS FUNCTION START ===');

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

    console.log('🚀 Requesting account list from Deriv API...');
    
    // Build the request URL and options
    const accountsUrl = 'https://api.deriv.com/api/v3';
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Deriv-App-ID': '33wk6T0W5ZsXYqjz3eY90'
      },
      body: JSON.stringify({ account_list: 1 })
    };

    console.log('📍 Accounts endpoint:', accountsUrl);
    console.log('📌 Request method: POST');
    
    const response = await fetch(accountsUrl, fetchOptions);
    
    console.log('Upstream status:', response.status);
    console.log('Upstream content type:', response.headers.get('content-type'));
    
    const responseText = await response.text();
    console.log('📄 Response length:', responseText.length);
    
    // Try to parse JSON
    let accountsData;
    try {
      accountsData = JSON.parse(responseText);
      console.log('✅ Valid JSON received from Deriv');
    } catch (e) {
      console.error('❌ JSON Parse Error:', e.message);
      console.error('Raw response:', responseText.substring(0, 500));
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Invalid JSON response: ${e.message}` })
      };
    }

    // Check for API errors
    if (accountsData.error) {
      console.error('❌ Deriv API Error:', accountsData.error.message);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: accountsData.error.message })
      };
    }

    // Check response status
    if (!response.ok) {
      console.error('❌ Non-200 response:', response.status);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: `Deriv API returned status ${response.status}`,
          details: accountsData
        })
      };
    }

    // Format accounts for frontend
    const formattedAccounts = [];
    if (accountsData.account_list && Array.isArray(accountsData.account_list)) {
      accountsData.account_list.forEach(account => {
        formattedAccounts.push({
          loginid: account.loginid,
          account_type: account.account_type || 'demo',
          currency: account.currency,
          is_virtual: account.is_virtual === 1,
          balance: account.balance || 0
        });
      });
    }

    console.log('✅ Accounts formatted successfully!', formattedAccounts.length, 'accounts ready for display');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        account_list: formattedAccounts
      })
    };
  } catch (error) {
    console.error('❌ Accounts error:', error.message);
    console.error('Stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};

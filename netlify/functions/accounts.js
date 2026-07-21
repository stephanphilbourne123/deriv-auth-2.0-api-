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

    console.log('🚀 Requesting account list from Deriv Options API...');
    
    // Use the correct NEW Options API endpoint (NOT legacy /api/v3)
    const accountsUrl = 'https://api.derivws.com/trading/v1/options/accounts';
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Deriv-App-ID': process.env.DERIV_APP_ID || '33wk6T0W5ZsXYqjz3eY90',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      redirect: 'manual'
    };

    console.log('📍 Accounts endpoint:', accountsUrl);
    console.log('📌 Request method: GET');
    
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
      console.error('❌ Deriv API Error:', accountsData.error);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: accountsData.error })
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

    // Handle different response formats from Deriv Options API
    let rawAccounts = [];
    if (Array.isArray(accountsData)) {
      rawAccounts = accountsData;
    } else if (accountsData.accounts && Array.isArray(accountsData.accounts)) {
      rawAccounts = accountsData.accounts;
    } else if (accountsData.data && Array.isArray(accountsData.data)) {
      rawAccounts = accountsData.data;
    }

    console.log('📈 Found', rawAccounts.length, 'accounts');

    // Format accounts for frontend using ChatGPT's recommended mapping
    const formattedAccounts = rawAccounts.map((account) => {
      const accountId = account.account_id || account.loginid || '';

      return {
        // Include both names so older selector code still works
        account_id: accountId,
        loginid: accountId,

        account_type: account.account_type || 'demo',
        is_virtual: account.account_type === 'demo' ? 1 : 0,

        currency: account.currency || 'USD',
        balance: Number(account.balance || 0),
        status: account.status || 'unknown'
        // NOTE: NOT disabling live accounts - they are fully enabled
      };
    });

    console.log('✅ Accounts formatted successfully!', formattedAccounts.length, 'accounts ready for display');
    formattedAccounts.forEach((acc, i) => {
      console.log(`Account ${i + 1}:`, JSON.stringify(acc));
    });
    
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

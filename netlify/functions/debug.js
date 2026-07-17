exports.handler = async (event, context) => {
  console.log('=== DEBUG FUNCTION ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  
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

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('Body:', body);
    console.log('Token:', body.token ? `Present (${body.token.substring(0, 20)}...)` : 'Missing');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        debug: {
          tokenPresent: !!body.token,
          tokenLength: body.token ? body.token.length : 0,
          receivedAt: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      })
    };
  }
};

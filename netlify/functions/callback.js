/**
 * Deriv OAuth 2.0 Callback Handler
 * This function processes the OAuth redirect from Deriv
 */

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { code, error, error_description } = event.queryStringParameters || {};

  // Handle OAuth errors from Deriv
  if (error) {
    console.error(`[Deriv OAuth Error] ${error}: ${error_description}`);
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error,
        message: error_description || "OAuth authorization failed",
      }),
    };
  }

  // Validate we got an authorization code
  if (!code) {
    console.error("[Deriv OAuth Error] No authorization code received");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: "missing_code",
        message: "No authorization code in callback",
      }),
    };
  }

  try {
    // In production: Exchange the code for an access token
    // This would call Deriv's token endpoint
    console.log(`[Deriv OAuth] Received code: ${code.substring(0, 10)}...`);

    // Store the code temporarily or immediately exchange it
    // For now, return it to the frontend
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        code: code,
        message: "Authorization code received. Exchange for access token.",
      }),
    };
  } catch (error) {
    console.error("[Deriv OAuth Error]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "server_error",
        message: error.message,
      }),
    };
  }
};

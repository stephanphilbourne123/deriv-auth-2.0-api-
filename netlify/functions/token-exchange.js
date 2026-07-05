/**
 * Deriv OAuth 2.0 Token Exchange
 * Exchanges authorization code for access token
 */

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { code } = body;

    if (!code) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "missing_code",
          message: "Authorization code is required",
        }),
      };
    }

    // Get environment variables
    const clientId = process.env.DERIV_CLIENT_ID;
    const clientSecret = process.env.DERIV_CLIENT_SECRET;
    const redirectUri = process.env.DERIV_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      console.error("[Token Exchange] Missing Deriv credentials in environment");
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: "server_error",
          message: "Server configuration error",
        }),
      };
    }

    // Exchange code for token with Deriv API
    const tokenResponse = await fetch("https://api.deriv.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error("[Token Exchange Error]", tokenData);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: tokenData.error || "token_exchange_failed",
          message: tokenData.error_description || "Failed to exchange code for token",
        }),
      };
    }

    // Success - return token data
    console.log("[Token Exchange] Success");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || "Bearer",
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token || null,
      }),
    };
  } catch (error) {
    console.error("[Token Exchange Error]", error);
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

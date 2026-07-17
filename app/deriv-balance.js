/**
 * Deriv API Balance Fetcher
 * Pulls balance data from Deriv and populates dashboard
 */

async function fetchDerivBalance() {
  try {
    let token = sessionStorage.getItem('deriv_token');
    const selectedAccount = JSON.parse(sessionStorage.getItem('selected_account') || '{}');
    
    if (!token || !selectedAccount.loginid) {
      console.warn('No token or account selected');
      return null;
    }

    // Fetch account balance
    const response = await fetch('https://api.deriv.com/api/v3/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorize: token,
        balance: 1,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Balance fetch error:', data.error);
      return null;
    }

    if (data.balance) {
      const balance = {
        currency: data.balance.currency,
        amount: data.balance.balance,
        login: data.balance.loginid,
      };

      // Update balance display in dashboard
      updateBalanceDisplay(balance);
      return balance;
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
    return null;
  }
}

function updateBalanceDisplay(balance) {
  // Update all balance elements in dashboard
  const balanceElements = document.querySelectorAll('[data-balance-display]');
  balanceElements.forEach(el => {
    el.textContent = balance.currency + ' ' + balance.amount.toFixed(2);
  });

  // Store balance in sessionStorage for real-time updates
  sessionStorage.setItem('deriv_balance', JSON.stringify(balance));
}

// Fetch balance on page load
document.addEventListener('DOMContentLoaded', () => {
  fetchDerivBalance();
  
  // Poll for balance updates every 30 seconds
  setInterval(fetchDerivBalance, 30000);
});

// Listen for visibility changes to refresh when tab becomes active
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    fetchDerivBalance();
  }
});

// v8.1 patch — Green=WIN, Red=LOSS + LIVE result from balance delta
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  ready(function(){
    const H = {
      pnl: document.getElementById('pnl'),
      trades: document.getElementById('trades'),
      wr: document.getElementById('wr'),
      hist: document.getElementById('history'),
      hnote: document.getElementById('hist-note')
    };
    if(!H.pnl||!H.trades||!H.wr||!H.hist){ console.warn('v8_1_patch: required nodes not found'); return; }

    let __wins = 0, __total = 0;

    function addHistoryRow(win, stake, type, symbol, live){
      __total++; H.trades.textContent = __total;
      if(win) __wins++;
      H.wr.textContent = ((__wins/__total)*100||0).toFixed(1)+'%';
      const cur = parseFloat(H.pnl.textContent)||0;
      const pnl = win ? (stake*0.95) : (-stake);
      H.pnl.textContent = (cur + pnl).toFixed(2);

      const card = document.createElement('div'); card.className = 'hrow ' + (win?'win':'loss');
      const now = new Date();
      const amt = (win? ('+'+(stake*0.95).toFixed(2)) : ('-'+stake.toFixed(2)))+' USD';
      const badge = '<span class=\"badge ' + (live?'live':'paper') + '\">' + (live?'LIVE':'PAPER') + '</span>';
      card.innerHTML =
        '<div class=\"hhead\"><div><b>'+symbol+
        '</b> · <span class=\"hmeta\">'+(type||'M Digit')+'</span>'+badge+
        '</div><div class=\"hamt '+(win?'win':'loss')+'\">'+amt+
        '</div></div><div class=\"hmeta\">'+now.toLocaleString()+'</div>';
      H.hist.prepend(card); if(H.hnote) H.hnote.textContent='';
    }

    window.__v81_addHistory = addHistoryRow;
    window.__v81 = window.__v81 || { lastLive:{ sent:false, stake:0, type:'', symbol:'', balBefore:null } };

    const prevOnMsg = window.onMsg;
    window.onMsg = function(e){
      try{
        const d = JSON.parse(e.data);
        if(d.msg_type==='buy'){
          const stake = parseFloat(d.buy.buy_price||d.buy.price||0)
            || parseFloat((document.getElementById('md-stake')||{value:'0.35'}).value);
          window.__v81.lastLive = {
            sent:true,
            stake: stake,
            type: (window.__v81_lastType||'M Digit'),
            symbol: (document.getElementById('md-symbol')||{value:'R_10'}).value,
            balBefore: window.__v81_lastBal
          };
        }
        if(d.msg_type==='balance'){
          const bal = d.balance.balance;
          window.__v81_lastBal = bal;
          const L = window.__v81.lastLive;
          if(L.sent && L.balBefore!=null){
            const delta = bal - L.balBefore;
            if(Math.abs(delta) > 0.0001){
              const win = delta > 0;
              addHistoryRow(win, L.stake, L.type, L.symbol, true);
              window.__v81.lastLive = { sent:false, stake:0, type:'', symbol:'', balBefore:bal };
            }
          }
        }
      }catch(err){}
      if(typeof prevOnMsg === 'function'){ prevOnMsg(e); }
    };
  });
})();
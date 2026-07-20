// Smart Parity / Under-Over engine
// Non-invasive: does not touch your M-Digit code

(function () {
  const CFG = {
    windowShort: 50,     // short history for fast bias
    windowLong: 120,     // long history to stabilize
    minTicks: 60,        // require at least this many ticks before firing
    fireThreshold: 62,   // confidence (0-100) needed to place a trade
    cooldownMs: 1100,    // minimum time between trades
    maxLossStreak: 3,    // stop trading after N consecutive losses (you reset externally)
    volGuardMinStd: 2.0, // require at least this std dev on last-digits windowLong
    streakBoost2: 6,     // bonus points if 2 in a row suggest the same side
    streakBoost3: 10,    // bonus points if 3+ in a row suggest the same side
    transWeight: 0.45,   // Markov transition model weight
    biasWeight: 0.45,    // frequency bias model weight
    voteWeight: 0.10,    // simple vote (short vs long) weight
  };

  // Internal state
  const S = {
    digits: [],         // rolling last digits (0..9)
    parity: [],         // 'E' or 'O'
    underOver: [],      // 'U' or 'O'
    lossStreak: 0,
    lastTradeTs: 0,
  };

  function pushDigit(d) {
    S.digits.push(d);
    if (S.digits.length > CFG.windowLong) S.digits.shift();

    const p = (d % 2 === 0) ? 'E' : 'O';
    const uo = (d <= 4) ? 'U' : 'O';
    S.parity.push(p);
    if (S.parity.length > CFG.windowLong) S.parity.shift();

    S.underOver.push(uo);
    if (S.underOver.length > CFG.windowLong) S.underOver.shift();
  }

  // Helpers
  function pct(x, n) { return n ? (100 * x / n) : 0; }
  function mean(arr){ return arr.reduce((a,b)=>a+b,0) / (arr.length||1); }
  function std(arr){
    if (!arr.length) return 0;
    const m = mean(arr);
    const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0) / arr.length;
    return Math.sqrt(v);
  }

  function count(arr, v){ return arr.filter(x=>x===v).length; }

  function markovNextProb(seq, states){
    // Build 1-step transition matrix on the fly
    // returns map {state -> probNext}
    const idx = new Map(states.map((s,i)=>[s,i]));
    const M = Array.from({length:states.length}, ()=>Array(states.length).fill(0));
    for (let i=1;i<seq.length;i++){
      const a = idx.get(seq[i-1]);
      const b = idx.get(seq[i]);
      if (a!=null && b!=null) M[a][b]++;
    }
    // Normalize rows
    const out = {};
    for (let r=0;r<M.length;r++){
      const rowSum = M[r].reduce((a,b)=>a+b,0);
      for (let c=0;c<M[r].length;c++){
        M[r][c] = rowSum ? M[r][c]/rowSum : 0.5; // default 0.5
      }
    }
    const last = seq[seq.length-1];
    const r = idx.get(last);
    if (r==null){
      states.forEach(s=>out[s]=1/states.length);
      return out;
    }
    states.forEach((s,c)=>{ out[s]=M[r][c]; });
    return out;
  }

  function streakInfo(seq){
    if (!seq.length) return {len:0, val:null};
    let len = 1, v = seq[seq.length-1];
    for (let i=seq.length-2;i>=0;i--){
      if (seq[i]===v) len++;
      else break;
    }
    return {len, val:v};
  }

  function parityBias(){
    const nS = Math.min(CFG.windowShort, S.parity.length);
    const nL = Math.min(CFG.windowLong,  S.parity.length);
    const lastS = S.parity.slice(-nS);
    const lastL = S.parity.slice(-nL);

    const evenS = count(lastS,'E'), oddS = count(lastS,'O');
    const evenL = count(lastL,'E'), oddL = count(lastL,'O');

    const pEven = (CFG.biasWeight)*pct(evenS,nS) + (1-CFG.biasWeight)*pct(evenL,nL);
    const pOdd  = (CFG.biasWeight)*pct(oddS, nS) + (1-CFG.biasWeight)*pct(oddL, nL);

    // Simple vote
    const votes = {E:0, O:0};
    votes[evenS>=oddS?'E':'O'] += 1;
    votes[evenL>=oddL?'E':'O'] += 1;

    return { pEven, pOdd, votes };
  }

  function uoBias(){
    const nS = Math.min(CFG.windowShort, S.underOver.length);
    const nL = Math.min(CFG.windowLong,  S.underOver.length);
    const lastS = S.underOver.slice(-nS);
    const lastL = S.underOver.slice(-nL);

    const uS = count(lastS,'U'), oS = count(lastS,'O');
    const uL = count(lastL,'U'), oL = count(lastL,'O');

    const pU = (CFG.biasWeight)*pct(uS,nS) + (1-CFG.biasWeight)*pct(uL,nL);
    const pO = (CFG.biasWeight)*pct(oS,nS) + (1-CFG.biasWeight)*pct(oL,nL);

    const votes = {U:0, O:0};
    votes[uS>=oS?'U':'O'] += 1;
    votes[uL>=oL?'U':'O'] += 1;

    return { pU, pO, votes };
  }

  function ensembleForParity(){
    const trans = markovNextProb(S.parity, ['E','O']); // % in 0..1
    const bias  = parityBias();
    const st    = streakInfo(S.parity);

    // Weighted score (0..100)
    let scoreE = 100*(CFG.transWeight*trans['E'] + CFG.biasWeight*(bias.pEven/100));
    let scoreO = 100*(CFG.transWeight*trans['O'] + CFG.biasWeight*(bias.pOdd/100));

    // Add tiny vote weight
    scoreE += CFG.voteWeight * 100 * (bias.votes['E']/2);
    scoreO += CFG.voteWeight * 100 * (bias.votes['O']/2);

    // Streak boost
    if (st.len>=2){
      if (st.val==='E') scoreE += CFG.streakBoost2;
      else scoreO += CFG.streakBoost2;
    }
    if (st.len>=3){
      if (st.val==='E') scoreE += CFG.streakBoost3;
      else scoreO += CFG.streakBoost3;
    }

    const signal = (scoreE>=scoreO) ? 'EVEN' : 'ODD';
    const confidence = Math.round(Math.max(scoreE, scoreO));
    const reason = [`Markov:E=${(trans['E']*100).toFixed(1)}% O=${(trans['O']*100).toFixed(1)}%`,
                    `Bias:E=${bias.pEven.toFixed(1)}% O=${bias.pOdd.toFixed(1)}%`,
                    `Streak ${st.len}× ${st.val||'-'}`];
    return {signal, confidence, reason};
  }

  function ensembleForUO(){
    const trans = markovNextProb(S.underOver, ['U','O']);
    const bias  = uoBias();
    const st    = streakInfo(S.underOver);

    let scoreU = 100*(CFG.transWeight*trans['U'] + CFG.biasWeight*(bias.pU/100));
    let scoreO = 100*(CFG.transWeight*trans['O'] + CFG.biasWeight*(bias.pO/100));

    scoreU += CFG.voteWeight * 100 * (bias.votes['U']/2);
    scoreO += CFG.voteWeight * 100 * (bias.votes['O']/2);

    if (st.len>=2){
      if (st.val==='U') scoreU += CFG.streakBoost2;
      else scoreO += CFG.streakBoost2;
    }
    if (st.len>=3){
      if (st.val==='U') scoreU += CFG.streakBoost3;
      else scoreO += CFG.streakBoost3;
    }

    const signal = (scoreU>=scoreO) ? 'UNDER' : 'OVER';
    const confidence = Math.round(Math.max(scoreU, scoreO));
    const reason = [`Markov:U=${(trans['U']*100).toFixed(1)}% O=${(trans['O']*100).toFixed(1)}%`,
                    `Bias:U=${bias.pU.toFixed(1)}% O=${bias.pO.toFixed(1)}%`,
                    `Streak ${st.len}× ${st.val||'-'}`];
    return {signal, confidence, reason};
  }

  function volatilityGuard(){
    // Use std dev of last digits to avoid flat tape
    const sd = std(S.digits.slice(-CFG.windowShort));
    return { ok: sd >= CFG.volGuardMinStd, sd };
  }

  function canFire(){
    const now = Date.now();
    if ((now - S.lastTradeTs) < CFG.cooldownMs) return false;
    if (S.lossStreak >= CFG.maxLossStreak) return false;
    if (S.digits.length < CFG.minTicks) return false;
    return true;
  }

  function recommend(kind /* 'PARITY' | 'UNDEROVER' */){
    const vol = volatilityGuard();
    const reasons = [];
    if (!vol.ok) reasons.push(`VOL GUARD sd=${vol.sd.toFixed(2)}`);

    if (!canFire()) {
      return { fire:false, signal:null, confidence:0, reason: reasons.length?reasons:['WAIT'] };
    }

    const res = (kind==='PARITY') ? ensembleForParity() : ensembleForUO();
    res.reason = reasons.concat(res.reason);
    const fire = vol.ok && (res.confidence >= CFG.fireThreshold);
    if (fire) S.lastTradeTs = Date.now();
    return { fire, ...res };
  }

  // Public API
  window.paritySmart = {
    onTick: (digit) => pushDigit(Number(digit)||0),
    recommend,
    // You can call this after a trade settles to manage brakes:
    reportResult: (win) => { S.lossStreak = win ? 0 : (S.lossStreak+1); },
    setLossStreak: (n) => { S.lossStreak = n|0; },
    _debug: {S, CFG}
  };
})();

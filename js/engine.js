// FundFit v3 planning engine. Pure functions, no DOM. Imported by the site and by the tests.
// The fund-type rules are the same tested rules as FundFit v2.

export const RULES = (() => {
  const HORIZONS = ['h0','h1','h2','h3','h4','h5','h6'];
  // General money, by horizon and how the person reacts to a 20% fall.
  // Nervous investors ("exit") never get a Very High-risk fund as the main suggestion.
  const TABLE = {
    h0: { exit:['liquid','overnight','money-market'], hold:['liquid','overnight','money-market'], add:['liquid','overnight','money-market'] },
    h1: { exit:['money-market','ultra-short-term','ultra-short-to-short'], hold:['money-market','ultra-short-to-short','arbitrage'], add:['money-market','arbitrage','ultra-short-to-short'] },
    h2: { exit:['short-term','banking-psu','corporate-bond'], hold:['short-term','corporate-bond','conservative-hybrid'], add:['equity-savings','conservative-hybrid','short-term'] },
    h3: { exit:['conservative-hybrid','short-term','corporate-bond'], hold:['equity-savings','conservative-hybrid','daaf'], add:['daaf','aggressive-hybrid','multi-asset'] },
    h4: { exit:['conservative-hybrid','equity-savings','daaf'], hold:['large-cap','daaf','flexi-cap','index-etf'], add:['flexi-cap','large-mid','aggressive-hybrid','index-etf'] },
    h5: { exit:['equity-savings','conservative-hybrid','daaf'], hold:['flexi-cap','large-cap','multi-asset','index-etf'], add:['large-mid','flexi-cap','mid-cap','index-etf'] },
    h6: { exit:['equity-savings','daaf','large-cap'], hold:['flexi-cap','multi-cap','large-mid','index-etf'], add:['flexi-cap','mid-cap','small-cap','index-etf'] },
  };
  // Must-have goals with a date (house, education). Within 5 years the money can't be at risk
  // of a deep fall, whatever the person's appetite; 5-7 years stays cautious.
  const GOAL = {
    h0: { exit:['liquid','overnight','money-market'], hold:['liquid','overnight','money-market'], add:['liquid','overnight','money-market'] },
    h1: { exit:['money-market','ultra-short-to-short','ultra-short-term'], hold:['money-market','ultra-short-to-short','ultra-short-term'], add:['money-market','ultra-short-to-short','arbitrage'] },
    h2: { exit:['short-term','banking-psu','corporate-bond'], hold:['short-term','banking-psu','corporate-bond'], add:['short-term','corporate-bond','banking-psu'] },
    h3: { exit:['corporate-bond','banking-psu','short-term'], hold:['corporate-bond','banking-psu','conservative-hybrid'], add:['corporate-bond','conservative-hybrid','banking-psu'] },
    h4: { exit:['conservative-hybrid','equity-savings','corporate-bond'], hold:['equity-savings','conservative-hybrid','daaf'], add:['daaf','aggressive-hybrid','large-cap'] },
  };
  const EQUITY_LIKE = new Set(['multi-cap','large-cap','large-mid','mid-cap','small-cap','flexi-cap','dividend-yield','value','contra','focused','sectoral','thematic','elss','aggressive-hybrid','balanced-hybrid','daaf','multi-asset','index-etf','life-cycle','equity-savings','conservative-hybrid']);
  const hi = (h) => HORIZONS.indexOf(h);

  function suggest(inp) {
    const out = { primary:null, alts:[], reasons:[], teach:[], warnings:[], notes:[] };
    const h = HORIZONS.includes(inp.horizon) ? inp.horizon : 'h4';
    const risk = ['exit','hold','add'].includes(inp.risk) ? inp.risk : 'hold';
    let list;

    if (inp.purpose === 'emergency') {
      list = TABLE.h0.hold.slice();
      out.reasons.push('r_emergency');
      if (hi(h) >= 3) out.notes.push('n_emergency_long');
    } else if (inp.purpose === 'goal' && GOAL[h]) {
      list = GOAL[h][risk].slice();
      out.reasons.push('r_h_' + h);
      out.reasons.push(hi(h) <= 3 ? 'r_goal_safe' : 'r_goal_cautious');
      if (hi(h) >= 2) out.notes.push('n_glide');
      if (risk === 'add' && hi(h) <= 3) out.teach.push('t_goal_appetite');
    } else {
      list = TABLE[h][risk].slice();
      out.reasons.push('r_h_' + h);
      if (hi(h) >= 3) out.reasons.push('r_risk_' + risk);

      if (inp.purpose === 'tax') {
        if (inp.regime === 'new') {
          out.notes.push('n_tax_new');
        } else if (hi(h) <= 2) {
          out.teach.push('t_elss_short');
        } else {
          list = ['elss', ...list.filter((x) => x !== 'elss')];
          out.reasons.unshift(inp.regime === 'unsure' ? 'r_elss_unsure' : 'r_elss');
          if (hi(h) === 3) out.warnings.push('w_elss_3to5');
          if (risk === 'exit') out.warnings.push('w_elss_nervous');
        }
      }
      if (inp.purpose === 'goal') { list.splice(1, 0, 'life-cycle'); out.notes.push('n_lifecycle', 'n_glide'); }
      if (risk === 'exit' && hi(h) >= 4) out.teach.push('t_ability_willingness');
      if (risk === 'add' && hi(h) <= 2) out.teach.push('t_short_high_appetite');
    }

    out.primary = list[0];
    out.alts = [...new Set(list.slice(1))].filter((x) => x !== out.primary).slice(0, 3);

    const all = [out.primary, ...out.alts];
    if (inp.purpose !== 'emergency' && inp.emergency === 'no' && EQUITY_LIKE.has(out.primary)) out.warnings.push('w_no_emergency');
    if (all.includes('small-cap')) out.notes.push('n_small_cap');
    if (inp.mode === 'lump' && EQUITY_LIKE.has(out.primary) && out.primary !== 'elss' && Number(inp.amount) >= 100000 && hi(h) >= 4) out.notes.push('n_stp');
    if (inp.mode === 'sip' && Number(inp.amount) > 0 && Number(inp.amount) < 500) out.notes.push('n_min_sip');
    if (inp.mode === 'lump' && Number(inp.amount) > 0 && Number(inp.amount) < 1000) out.notes.push('n_min_lump');
    if (out.primary === 'elss' && inp.mode === 'sip') out.notes.push('n_elss_sip');
    return out;
  }
  return { suggest, HORIZONS, TABLE, GOAL };
})();

export const EXPLAIN = {
  en: {
    r_emergency:"Emergency money has to reach you within a day and should be very unlikely to lose value. Liquid funds are designed for that.",
    n_emergency_long:"Even if it sits untouched for years, emergency money stays in a liquid-type fund. Its job is to be there when you need it, not to grow.",
    r_h_h0:"Under 3 months, only the shortest, safest debt funds make sense. Anything else could be down on the day you need the money.",
    r_h_h1:"For 3 to 12 months, funds that lend only for short periods keep your money steady.",
    r_h_h2:"For 1 to 3 years, shares are too unpredictable. High-quality debt funds that lend for 1 to 3 years match your timeline.",
    r_h_h3:"At 3 to 5 years, a small amount of shares can help, but most of the money should stay in steadier investments.",
    r_h_h4:"At 5 to 7 years, shares have usually had time to recover from a bad patch, so they can do more of the work.",
    r_h_h5:"At 7 to 10 years, shares are the main engine of growth. Short-term falls matter less over this span.",
    r_h_h6:"At 10+ years, time is on your side. A diversified equity fund can ride out several market cycles.",
    r_goal_safe:"This is money for a goal that can't move, like a house or college fees. Within 5 years, even a bold investor shouldn't risk a 30% fall just before the deadline.",
    r_goal_cautious:"This money has a fixed date, so the suggestion stays cautious: some growth, but with a cushion against a bad year near the end.",
    t_goal_appetite:"You're comfortable with risk, but this goal has a deadline. A market fall right before it could leave you short, and there'd be no time to recover. Keep the goal money safe and take risk with money that has no deadline.",
    n_glide:"As the goal gets closer, move money step by step into safer funds. Aim to have it all in debt or liquid funds about 2 years before you need it.",
    r_risk_exit:"You said you'd sell after a 20% fall, so the suggestion picks funds that fall less. A fund you'll stay in beats a better fund you'll panic out of.",
    r_risk_hold:"You'd hold through a fall, so a diversified, steady equity fund fits.",
    r_risk_add:"You'd buy more after a fall, so you can handle funds that swing harder in return for more growth.",
    r_elss:"You file under the old regime, so ELSS qualifies for the tax-saving deduction of up to ₹1.5 lakh a year (Section 123 of the Income-tax Act 2025, formerly Section 80C). Your money is locked in for 3 years.",
    r_elss_unsure:"ELSS saves tax only under the old tax regime. Check which regime you file under before relying on the deduction.",
    n_tax_new:"The new tax regime has no deduction for tax-saving investments, so ELSS gives no tax benefit there. This goal is treated as regular investing.",
    t_elss_short:"ELSS locks every instalment for 3 years, but you need this money sooner. Don't lock up money you'll need just to save tax, so ELSS isn't suggested here.",
    w_elss_3to5:"With 3 to 5 years, the ELSS lock-in fits, but shares can still be down when it ends. Be ready to wait a little longer.",
    w_elss_nervous:"ELSS is a pure equity fund and can fall 20% or more. If that would make you sell, save tax with PPF or a similar option instead, and keep ELSS small.",
    n_lifecycle:"Life Cycle Funds (a new category from 2026) are designed for dated goals. Pick one whose target year is close to, and not after, your goal year. It shifts from shares to debt by itself as the year approaches.",
    t_ability_willingness:"Your timeline can handle shares, but your comfort level says otherwise. Both matter: being able to take risk and being willing to live with it. Starting gentler is fine; you can add more equity as you get used to the ups and downs.",
    t_short_high_appetite:"Your appetite for risk is high, but your time is short. Shares can stay down for 3 years or more, so the timeline wins here.",
    w_no_emergency:"Build your emergency fund first. Keep 3 to 6 months of expenses in a liquid fund, then start this. Otherwise a surprise bill could force you to sell at a loss.",
    n_small_cap:"Small caps swing the most of any equity fund. If you choose one, keep it to a part of your equity money, not all of it.",
    n_stp:"For a large lumpsum into equity, consider parking it in a liquid fund and moving it in gradually over 6 to 12 months (an STP). It softens the risk of investing just before a fall.",
    n_min_sip:"Many funds need at least ₹500 a month for a SIP (some allow ₹100). Check the minimum in the fund's details.",
    n_min_lump:"Many funds need a minimum lumpsum of ₹1,000 to ₹5,000. Check the minimum in the fund's details.",
    n_elss_sip:"With an ELSS SIP, each monthly instalment is locked for its own 3 years. The last one unlocks 3 years after you pay it.",
    t_limited_ability:"Your comfort with risk is higher than your financial situation allows right now (age, dependants, income, savings or loans). The fund categories here follow the more careful of the two.",
    t_limited_willingness:"Your finances could take more risk, but your comfort with market falls is lower. The fund categories here follow the more careful of the two; we can revisit this as you get used to investing.",
    n_tax_profile:"ELSS is an equity fund with Very High risk, which doesn't match your risk profile. Other tax-saving options such as PPF may suit you better; let's discuss.",
    r_long_balanced:"You have time for growth, and your profile suits a steadier ride than pure equity: mostly shares, with a debt cushion to soften falls.",
    r_long_cautious:"You have time on your side, but your profile calls for a steady ride, so this leans on debt with a smaller share in equity for some growth.",
    n_mixed:"Some of your answers pull in different directions, so the more careful answer has been used. We'll talk this through.",
  }
};

export const ALT_WHY = {
  'overnight':"Even lower risk, slightly lower returns. Best for days to weeks.",
  'liquid':"The standard emergency and short-parking choice; money back by the next working day.",
  'money-market':"A little more return than liquid for money parked 3-12 months.",
  'ultra-short-term':"For money needed in 3 to 6 months.",
  'ultra-short-to-short':"For money needed in 6 to 12 months.",
  'arbitrage':"Similar low risk, but taxed like equity, which can suit higher tax brackets. Check the exit load period.",
  'short-term':"High-quality lending for 1 to 3 years; modest ups and downs.",
  'banking-psu':"Lends mainly to banks and government-owned companies, so credit risk is generally lower.",
  'corporate-bond':"Only top-rated companies (AA+ and above).",
  'conservative-hybrid':"Mostly debt with 10-25% equity for a little extra growth.",
  'equity-savings':"Only 15–40% moves with the stock market; the rest is hedged or in debt.",
  'daaf':"Shifts between equity and debt by itself as markets get cheaper or dearer.",
  'aggressive-hybrid':"65-80% equity with a debt cushion.",
  'multi-asset':"Equity, debt and gold/silver in one fund.",
  'large-cap':"India's 100 biggest companies. The steadiest equity choice.",
  'flexi-cap':"The manager chooses the mix of large, mid and small caps.",
  'multi-cap':"Required spread: at least 25% each in large, mid and small caps.",
  'large-mid':"Half large, half mid caps for more growth potential.",
  'mid-cap':"Mid-sized companies: more growth, deeper falls.",
  'small-cap':"Highest growth potential and highest volatility. Only for part of your equity money.",
  'index-etf':"The passive route: copies an index like the Nifty 50 at a very low cost.",
  'elss':"Tax deduction under the old regime, with a 3-year lock-in.",
  'life-cycle':"Pick a target year; it moves from equity to debt automatically as the year nears.",
};




/* ================================================================
   INVESTOR PROFILE
   Two scores, both on a 1-5 scale:
   - Ability to take risk: age, dependants, income stability, emergency cushion, loan burden.
   - Willingness to take risk: reaction to a fall, choice of outcomes, experience, objective.
   The profile is the LOWER of the two (standard suitability practice: never push someone past
   either their finances or their comfort). Each goal then applies its own time horizon ("need").
   ================================================================ */
export const PROFILE_QUESTIONS = [
  { id: 'age', part: 'ability', q: 'Your age', options: [
    ['u30', 'Under 30', 4], ['30s', '30 to 39', 3], ['40s', '40 to 49', 2], ['50s', '50 to 59', 1], ['60p', '60 or above', 0]] },
  { id: 'dependants', part: 'ability', q: 'How many people depend on your income?', options: [
    ['0', 'No one', 2], ['1-2', 'One or two', 1], ['3p', 'Three or more', 0]] },
  { id: 'income', part: 'ability', q: 'How steady is your income?', options: [
    ['steady', 'Steady (salary or a stable business)', 2], ['variable', 'Varies month to month', 1], ['irregular', 'Irregular, or I\'m retired', 0]] },
  { id: 'cushion', part: 'ability', q: 'How many months of expenses do you have set aside for emergencies?', options: [
    ['6p', '6 months or more', 2], ['3-6', '3 to 6 months', 1], ['u3', 'Less than 3 months', 0]] },
  { id: 'emi', part: 'ability', q: 'What share of your monthly income goes to loan EMIs?', options: [
    ['u20', 'None, or under 20%', 2], ['20-40', '20% to 40%', 1], ['40p', 'More than 40%', 0]] },
  { id: 'fall', part: 'willingness', q: 'Your investments fall 20% in a bad year. What do you do?', options: [
    ['sell', 'Sell, so I don\'t lose more', 0], ['wait', 'Hold and wait for recovery', 2], ['buy', 'Invest more while prices are low', 4]] },
  { id: 'range', part: 'willingness', q: 'You invest ₹1 lakh for a year. Which range of outcomes would you pick?', options: [
    ['a', 'Between ₹98,000 and ₹1,08,000', 0], ['b', 'Between ₹90,000 and ₹1,20,000', 2], ['c', 'Between ₹75,000 and ₹1,40,000', 4]] },
  { id: 'experience', part: 'willingness', q: 'What have you invested in before?', options: [
    ['none', 'Only savings accounts', 0], ['fd', 'Fixed deposits, PPF or gold', 1], ['some', 'Mutual funds or shares, under 3 years', 2], ['long', 'Mutual funds or shares, 3+ years', 3]] },
  { id: 'objective', part: 'willingness', q: 'What matters most to you in investing?', options: [
    ['protect', 'Not losing what I have', 0], ['income', 'Steady, predictable growth', 1], ['balanced', 'A balance of growth and safety', 2], ['growth', 'The most growth over time', 3]] },
];
export const PROFILE_LEVELS = [
  null,
  { n: 'Conservative', d: 'You put safety first. Most of your money suits debt funds, with only a small share in equity for long-term goals.', da: 'Your finances call for safety first right now. Most of your money suits debt funds, with only a small share in equity for long-term goals.' },
  { n: 'Moderately conservative', d: 'You want steady progress with limited ups and downs. Hybrid funds that are mostly debt suit you, with some equity for long goals.', da: 'Your finances call for steady progress with limited ups and downs right now. Hybrid funds that are mostly debt suit you, with some equity for long goals.' },
  { n: 'Moderate', d: 'You can accept some ups and downs for better growth. A balance of equity and debt suits you, leaning to equity for long goals.' },
  { n: 'Moderately aggressive', d: 'You\'re comfortable with market swings for higher long-term growth. Equity can carry most of your long-term money.' },
  { n: 'Aggressive', d: 'You can ride out deep falls in pursuit of the highest long-term growth. Equity, including smaller companies, suits your long-term money.' },
];
const band = (score, cuts) => 1 + cuts.filter((c) => score >= c).length; // cuts: 4 thresholds -> 1..5

export function scoreProfile(ans) {
  let ability = 0, willingness = 0, answered = 0;
  for (const q of PROFILE_QUESTIONS) {
    const o = q.options.find((x) => x[0] === ans[q.id]);
    if (!o) continue;
    answered++;
    if (q.part === 'ability') ability += o[2]; else willingness += o[2];
  }
  const complete = answered === PROFILE_QUESTIONS.length;
  const a = band(ability, [3, 6, 9, 11]);       // max 12
  let w = band(willingness, [4, 7, 10, 13]);    // max 14
  // The reaction to a fall is the strongest signal of real behaviour, so it caps the score:
  // someone who would sell after a 20% fall can't be rated above moderately conservative.
  const caps = [];
  if (ans.fall === 'sell') caps.push(2);
  if (ans.range === 'a' || ans.objective === 'protect') caps.push(3);
  const capped = caps.length ? Math.min(w, ...caps) : w;
  const mixed = capped < w;
  w = capped;
  const level = Math.min(a, w);
  const limitedBy = a < w ? 'ability' : w < a ? 'willingness' : 'both';
  return { complete, ability, willingness, abilityLevel: a, willingnessLevel: w, level, name: PROFILE_LEVELS[level].n, limitedBy, mixed };
}
// How the profile feeds the tested per-goal rules (the "20% fall" reaction they use).
export const riskKeyFor = (level) => (level <= 2 ? 'exit' : level <= 4 ? 'hold' : 'add');

/* ================================================================
   GOALS
   ================================================================ */
export const GOAL_TYPES = {
  emergency: { n: 'Emergency fund', icon: '🛟', purpose: 'emergency', inflation: 0, hint: 'Money you can reach within a day or two' },
  education: { n: 'Child\'s education', icon: '🎓', purpose: 'goal', inflation: 10, hint: 'College or school fees on a fixed date' },
  house: { n: 'Buying a home', icon: '🏠', purpose: 'goal', inflation: 7, hint: 'Down payment for a house' },
  car: { n: 'Buying a car', icon: '🚗', purpose: 'goal', inflation: 6, hint: 'A car or other big purchase' },
  wedding: { n: 'Wedding', icon: '💍', purpose: 'goal', inflation: 7, hint: 'Your own or a family member\'s' },
  retirement: { n: 'Retirement', icon: '🌅', purpose: 'goal', inflation: 6, hint: 'A corpus to live on after you stop working' },
  wealth: { n: 'Growing wealth', icon: '🌳', purpose: 'wealth', inflation: 6, hint: 'No fixed date or amount' },
  tax: { n: 'Saving tax', icon: '🧾', purpose: 'tax', inflation: 0, hint: 'Tax-saving deduction, old regime' },
};
export function horizonKey(years) {
  if (years < 0.25) return 'h0';
  if (years < 1) return 'h1';
  if (years <= 3) return 'h2';
  if (years <= 5) return 'h3';
  if (years <= 7) return 'h4';
  if (years <= 10) return 'h5';
  return 'h6';
}
// Planning assumptions by fund type: a cautious long-run yearly return, used only to size a goal.
// Shown to the user as an editable assumption, never as a promise.
export const ASSUMED_RETURN = {
  overnight: 5.5, liquid: 6, 'money-market': 6.5, 'ultra-short-term': 6.5, 'ultra-short-to-short': 6.5, arbitrage: 6.5,
  'short-term': 7, 'banking-psu': 7, 'corporate-bond': 7, 'floating': 7, 'gilt': 7, 'medium-term': 7, 'medium-long': 7, 'long-term': 7, 'dynamic-term': 7, 'gilt-10yr': 7, 'credit-risk': 7.5, 'sectoral-debt': 7,
  'conservative-hybrid': 8, 'equity-savings': 8, daaf: 9, 'balanced-hybrid': 9, 'multi-asset': 9.5, 'aggressive-hybrid': 10, 'life-cycle': 9.5,
  'large-cap': 11, 'index-etf': 11, 'flexi-cap': 11, 'multi-cap': 11.5, 'large-mid': 11.5, elss: 11, 'dividend-yield': 10.5, value: 11, contra: 11, focused: 11, 'mid-cap': 12, 'small-cap': 12, sectoral: 11, thematic: 11, fof: 9,
};
// Rough share in equity for each fund type, to show the overall mix of a plan.
export const EQUITY_SHARE = {
  overnight: 0, liquid: 0, 'money-market': 0, 'ultra-short-term': 0, 'ultra-short-to-short': 0, 'short-term': 0, 'banking-psu': 0, 'corporate-bond': 0, floating: 0, gilt: 0, 'medium-term': 0, 'medium-long': 0, 'long-term': 0, 'dynamic-term': 0, 'gilt-10yr': 0, 'credit-risk': 0, 'sectoral-debt': 0,
  arbitrage: 0, 'conservative-hybrid': 20, 'equity-savings': 30, daaf: 50, 'balanced-hybrid': 50, 'multi-asset': 50, 'aggressive-hybrid': 75, 'life-cycle': 60,
  'large-cap': 100, 'index-etf': 100, 'flexi-cap': 100, 'multi-cap': 100, 'large-mid': 100, elss: 100, 'dividend-yield': 100, value: 100, contra: 100, focused: 100, 'mid-cap': 100, 'small-cap': 100, sectoral: 100, thematic: 100, fof: 50,
};

// Typical riskometer level of each fund type, 0 = Low ... 5 = Very High (mirrors categories.json).
export const RISK_OF = {"multi-cap":5,"large-cap":5,"large-mid":5,"mid-cap":5,"small-cap":5,"flexi-cap":5,"dividend-yield":5,"value":5,"contra":5,"focused":5,"sectoral":5,"thematic":5,"elss":5,"overnight":0,"liquid":1,"ultra-short-term":1,"ultra-short-to-short":1,"money-market":1,"short-term":2,"medium-term":2,"medium-long":2,"long-term":2,"dynamic-term":2,"corporate-bond":2,"credit-risk":3,"banking-psu":2,"gilt":2,"gilt-10yr":2,"floating":2,"sectoral-debt":2,"conservative-hybrid":3,"balanced-hybrid":5,"aggressive-hybrid":5,"daaf":5,"multi-asset":5,"arbitrage":0,"equity-savings":3,"life-cycle":5,"index-etf":5,"fof":5,"retirement":5,"children":5};
// What each profile level may be shown. Levels 1-2: nothing above Moderately High.
// Level 3: Very High only through hybrids, large caps and index funds. Level 4: adds diversified
// equity. Level 5: everything, including mid, small, sector and theme funds.
const L3_VERY_HIGH = new Set(['large-cap', 'index-etf', 'aggressive-hybrid', 'balanced-hybrid', 'daaf', 'multi-asset', 'life-cycle', 'elss']);
const L5_ONLY = new Set(['mid-cap', 'small-cap', 'sectoral', 'thematic', 'credit-risk']);
export function allowedFor(level, id) {
  const r = RISK_OF[id] ?? 5;
  if (level <= 2) return r <= 3;
  if (level === 3) return r <= 4 || L3_VERY_HIGH.has(id);
  if (level === 4) return !L5_ONLY.has(id);
  return true;
}
// Fallbacks by profile level for money that can stay invested 5+ years.
const LONG_BY_LEVEL = {
  1: ['conservative-hybrid', 'corporate-bond', 'banking-psu', 'short-term'],
  2: ['equity-savings', 'conservative-hybrid', 'corporate-bond'],
  3: ['aggressive-hybrid', 'daaf', 'large-cap', 'index-etf', 'multi-asset'],
  4: ['flexi-cap', 'large-cap', 'large-mid', 'multi-cap', 'index-etf', 'aggressive-hybrid'],
  5: ['flexi-cap', 'large-mid', 'mid-cap', 'multi-cap', 'index-etf'],
};

export const fv = (pv, ratePct, years) => pv * Math.pow(1 + ratePct / 100, years);
// Monthly SIP (paid at the start of each month) that grows to `target` in `years` at `ratePct` a year.
export function sipNeeded(target, ratePct, years) {
  const n = Math.round(years * 12);
  if (target <= 0) return 0;
  if (n <= 0) return target;
  const i = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
  if (i === 0) return target / n;
  return target / (((Math.pow(1 + i, n) - 1) / i) * (1 + i));
}
const roundTo = (x, step) => Math.ceil(x / step) * step;
const SAFE_RATE = 7; // the last 2 years of a dated goal, after moving to safer funds; also used for money already saved
// Future value of 1 rupee a month (paid at the start of each month) over `months`, earning
// `rate` until the last `safeMonths`, then `safe`.
export function sipFactor(months, rate, safe, safeMonths) {
  const i1 = Math.pow(1 + rate / 100, 1 / 12) - 1, i2 = Math.pow(1 + safe / 100, 1 / 12) - 1;
  let v = 0;
  for (let m = 0; m < months; m++) v = (v + 1) * (1 + (m >= months - safeMonths ? i2 : i1));
  return v;
}
export function lumpFactor(months, rate, safe, safeMonths) {
  const early = Math.max(0, months - safeMonths), late = months - early;
  return Math.pow(1 + rate / 100, early / 12) * Math.pow(1 + safe / 100, late / 12);
}

// One goal -> fund category + sizing. `now` may be fractional (2026.74 = late September 2026).
// Dated goals are taken to fall in the middle of their target year.
export function planGoal(goal, profile, now) {
  const t = GOAL_TYPES[goal.type];
  const level = profile.level || 3;
  let years;
  if (goal.type === 'emergency') years = 0.1;
  else if (goal.type === 'wealth' || goal.type === 'tax') years = Math.max(1, Number(goal.years) || 10);
  else years = Math.max(0.1, (Number(goal.year) || Math.floor(now)) + 0.5 - now);
  const h = horizonKey(years);
  const regime = goal.regime || 'old';
  const s = RULES.suggest({ purpose: t.purpose, horizon: h, risk: riskKeyFor(level), emergency: profile.hasCushion ? 'yes' : 'no', regime, mode: 'sip', amount: 5000 });

  // Apply the profile's limits to the rules' suggestions, falling back to level-appropriate types.
  const longish = ['h4', 'h5', 'h6'].includes(h) && t.purpose !== 'emergency';
  // For cautious to moderate profiles, long-term money leads with the profile's own steadier choices.
  let pool = longish && level <= 3 && t.purpose !== 'tax' ? [...LONG_BY_LEVEL[level], s.primary, ...s.alts] : [s.primary, ...s.alts, ...(longish ? LONG_BY_LEVEL[level] : [])];
  if (goal.type === 'tax' && level <= 2 && pool.includes('elss')) { s.notes.push('n_tax_profile'); s.reasons = s.reasons.filter((k) => !k.startsWith('r_elss')); s.warnings = s.warnings.filter((k) => !k.startsWith('w_elss')); }
  pool = [...new Set(pool)].filter((id) => allowedFor(level, id));
  if (!pool.length) pool = ['conservative-hybrid'];
  // Life Cycle Funds are new (2026) with few schemes yet: offer them as an alternative, not the headline.
  if (pool[0] === 'life-cycle' && pool.length > 1) pool = [...pool.slice(1, 2), 'life-cycle', ...pool.slice(2)];
  s.primary = pool[0]; s.alts = pool.slice(1, 4);
  if (s.primary !== 'elss') { s.reasons = s.reasons.filter((k) => !k.startsWith('r_elss')); s.warnings = s.warnings.filter((k) => !k.startsWith('w_elss')); s.notes = s.notes.filter((k) => k !== 'n_elss_sip'); }
  if (![s.primary, ...s.alts].includes('life-cycle')) s.notes = s.notes.filter((k) => k !== 'n_lifecycle');
  // Explanations must describe the fund actually shown, not the all-equity fund the rules started from.
  const eq = EQUITY_SHARE[s.primary] ?? 50;
  if (longish && eq < 100 && (t.purpose !== 'tax' || s.primary !== 'elss')) {
    s.reasons = s.reasons.filter((k) => !/^r_h_h[456]$/.test(k) && !k.startsWith('r_risk_'));
    s.reasons.unshift(eq >= 50 ? 'r_long_balanced' : 'r_long_cautious');
  }
  if (eq === 0) s.notes = s.notes.filter((k) => k !== 'n_glide');
  s.taxBenefit = goal.type !== 'tax' ? null : s.primary === 'elss' && regime !== 'new';
  // Explain which side limited the profile, rather than assuming it was comfort with risk.
  s.teach = s.teach.filter((k) => k !== 't_ability_willingness');
  if (level <= 2 && ['h4', 'h5', 'h6'].includes(h) && t.purpose !== 'emergency' && profile.limitedBy !== 'both') s.teach.push(profile.limitedBy === 'ability' ? 't_limited_ability' : 't_limited_willingness');

  const rate = Number(goal.rate) > 0 ? Number(goal.rate) : ASSUMED_RETURN[s.primary] ?? 8;
  const inflation = goal.inflation != null && goal.inflation !== '' ? Number(goal.inflation) : t.inflation;
  const months = Math.max(1, Math.round(years * 12));
  // Dated goals move to safer funds for the last 2 years, so sizing assumes the safer rate then.
  const dated = t.purpose === 'goal';
  const safe = Math.min(rate, SAFE_RATE);
  const safeMonths = dated && rate > SAFE_RATE ? Math.min(24, months) : 0;
  let target = null, futureCost = null, gap = null, sip = null, lumpsum = null;
  if (goal.type === 'emergency') {
    target = Math.max(0, Number(goal.monthly) || 0) * (Number(goal.months) || 6);
    gap = Math.max(0, target - (Number(goal.saved) || 0));
    lumpsum = gap;
  } else if (goal.type !== 'wealth' && goal.type !== 'tax') {
    // Retirement is sized from today's monthly expenses: about 30 years of expenses as a corpus.
    const today = goal.type === 'retirement' && goal.monthly ? Number(goal.monthly) * 12 * RETIREMENT_MULTIPLE : Number(goal.cost) || 0;
    futureCost = fv(today, inflation, years);
    const savedGrows = fv(Number(goal.saved) || 0, SAFE_RATE, years);
    gap = Math.max(0, futureCost - savedGrows);
    sip = gap > 0 ? roundTo(gap / sipFactor(months, rate, safe, safeMonths), 100) : 0;
    lumpsum = gap > 0 ? roundTo(gap / lumpFactor(months, rate, safe, safeMonths), 1000) : 0;
  }
  return { goal, type: t, years, horizon: h, suggestion: s, rate, safeRate: safeMonths ? safe : null, inflation, target, futureCost, gap, sip, lumpsum, equity: EQUITY_SHARE[s.primary] ?? 50 };
}
export const RETIREMENT_MULTIPLE = 30;
export const MAX_AMOUNT = 1e9; // ₹100 crore

export function planAll(state, now = new Date().getFullYear()) {
  const p = scoreProfile(state.profile || {});
  p.hasCushion = (state.profile || {}).cushion !== 'u3';
  const goalsIn = sanitizeGoals(state.goals || []);
  const goals = goalsIn.map((g) => planGoal(g, p, now));
  // Overall equity share, weighted by the monthly amount each goal needs (or its SIP if set).
  const weights = goals.map((g) => Number(g.goal.sipNow) || g.sip || (g.lumpsum ? g.lumpsum / 60 : 0));
  const tot = weights.reduce((a, b) => a + b, 0);
  const equity = tot ? Math.round(goals.reduce((a, g, i) => a + g.equity * weights[i], 0) / tot) : null;
  const monthlyNeeded = goals.reduce((a, g) => a + (g.sip || 0), 0);
  return { profile: p, goals, equity, monthlyNeeded };
}

/* ================================================================
   SHARING: the whole state travels in the link, so nothing is stored anywhere.
   ================================================================ */
export function encodeState(state) {
  const json = JSON.stringify(state);
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Everything that can arrive from outside (a shared link, old saved data) is rebuilt from a
// whitelist, so nothing unexpected can reach the page.
const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
export function sanitizeProfile(p) {
  const out = {};
  for (const q of PROFILE_QUESTIONS) { const v = p && p[q.id]; if (q.options.some((o) => o[0] === v)) out[q.id] = v; }
  return out;
}
export function sanitizeGoals(goals) {
  if (!Array.isArray(goals)) return [];
  const out = [];
  for (const g of goals.slice(0, 12)) {
    if (!g || typeof g !== 'object' || !Object.prototype.hasOwnProperty.call(GOAL_TYPES, g.type)) continue;
    const c = { id: /^[a-z0-9]{1,8}$/.test(String(g.id)) ? String(g.id) : Math.random().toString(36).slice(2, 8), type: g.type, label: str(g.label, 40) || GOAL_TYPES[g.type].n };
    for (const [k, lo, hi] of [['cost', 0, MAX_AMOUNT], ['saved', 0, MAX_AMOUNT], ['monthly', 0, MAX_AMOUNT], ['sipNow', 0, MAX_AMOUNT], ['year', 1900, 2200], ['years', 0, 60], ['inflation', 0, 30], ['rate', 0, 30]]) {
      if (g[k] !== undefined && g[k] !== '' && g[k] !== null) { const v = num(g[k], lo, hi); if (v !== undefined) c[k] = v; }
    }
    if (g.type === 'emergency') c.months = [3, 6, 9, 12].includes(Number(g.months)) ? Number(g.months) : 6;
    if (g.type === 'tax') c.regime = ['old', 'new', 'unsure'].includes(g.regime) ? g.regime : 'old';
    out.push(c);
  }
  return out;
}
export function sanitizeState(s) {
  if (!s || typeof s !== 'object') return null;
  return { name: str(s.name, 60), profile: sanitizeProfile(s.profile), goals: sanitizeGoals(s.goals) };
}
export function decodeState(code) {
  try {
    const b64 = String(code).replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
    return sanitizeState(JSON.parse(json));
  } catch { return null; }
}

export const rupees = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export function short(n) {
  n = Math.round(Number(n) || 0);
  if (n >= 1e7) return '₹' + (n / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' crore';
  if (n >= 1e5) return '₹' + (n / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' lakh';
  return rupees(n);
}

// Plain-text summary for WhatsApp / email. `catName(id)` resolves fund type names.
export function summaryText(state, plan, catName, link) {
  const lines = [];
  lines.push(`Hi, I've completed my goal and risk profile${state.name ? ' (' + state.name + ')' : ''}.`);
  lines.push('');
  lines.push(`Risk profile: ${plan.profile.name}`);
  for (const g of plan.goals) {
    const when = g.goal.type === 'emergency' ? 'now' : g.goal.type === 'wealth' || g.goal.type === 'tax' ? `${Math.round(g.years)} yrs` : `in ${g.goal.year}`;
    let amt = '';
    if (g.goal.type === 'emergency' && g.target) amt = `, target ${short(g.target)}`;
    else if (g.futureCost) amt = `, needs about ${short(g.futureCost)}`;
    lines.push(`• ${g.goal.label || g.type.n} (${when}${amt}): ${catName(g.suggestion.primary)}`);
  }
  if (plan.monthlyNeeded) lines.push(`Monthly investment for dated goals (estimate): ${rupees(plan.monthlyNeeded)}`);
  lines.push('');
  lines.push('My summary: ' + link);
  lines.push('I\'d like to discuss which schemes suit me.');
  return lines.join('\n');
}

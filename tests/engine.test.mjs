import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROFILE_QUESTIONS, scoreProfile, riskKeyFor, horizonKey, sipNeeded, fv, planAll, planGoal, encodeState, decodeState, summaryText, GOAL_TYPES, EQUITY_SHARE, ASSUMED_RETURN, RISK_OF, allowedFor, sipFactor, RETIREMENT_MULTIPLE, sanitizeState } from '../js/engine.js';

const { categories } = JSON.parse(await readFile(new URL('../data/categories.json', import.meta.url), 'utf8'));
const cat = Object.fromEntries(categories.map((c) => [c.id, c]));
const RISK = ['Low', 'Low to Moderate', 'Moderate', 'Moderately High', 'High', 'Very High'];
const risk = (id) => RISK.indexOf(cat[id].risk);
const pick = (i) => Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.id, q.options[Math.min(i, q.options.length - 1)][0]]));
const lowest = Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.id, q.options.reduce((a, o) => (o[2] < a[2] ? o : a))[0]]));
const highest = Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.id, q.options.reduce((a, o) => (o[2] > a[2] ? o : a))[0]]));

test('profile scoring covers the full range and takes the lower of ability and willingness', () => {
  assert.equal(scoreProfile(lowest).level, 1);
  assert.equal(scoreProfile(highest).level, 5);
  assert.equal(scoreProfile({}).complete, false);
  const bold = { ...lowest, fall: 'buy', range: 'c', experience: 'long', objective: 'growth' };
  const r = scoreProfile(bold);
  assert.equal(r.willingnessLevel, 5); assert.equal(r.abilityLevel, 1); assert.equal(r.level, 1); assert.equal(r.limitedBy, 'ability');
  const timid = { ...highest, fall: 'sell', range: 'a', experience: 'none', objective: 'protect' };
  assert.equal(scoreProfile(timid).level, 1); assert.equal(scoreProfile(timid).limitedBy, 'willingness');
  // Every combination of answers gives a level 1..5 (sampled exhaustively over 3 options per question)
  for (let i = 0; i < 3 ** 9; i++) {
    const a = {}; let k = i;
    for (const q of PROFILE_QUESTIONS) { a[q.id] = q.options[k % Math.min(3, q.options.length)][0]; k = Math.floor(k / 3); }
    const s = scoreProfile(a); assert.ok(s.level >= 1 && s.level <= 5 && s.complete);
  }
});

test('risk key mapping is monotonic', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(riskKeyFor), ['exit', 'exit', 'hold', 'hold', 'add']);
});

test('horizon boundaries', () => {
  assert.deepEqual([0.1, 0.5, 1, 3, 3.5, 5, 6, 7, 8, 10, 11].map(horizonKey), ['h0', 'h1', 'h2', 'h2', 'h3', 'h3', 'h4', 'h4', 'h5', 'h5', 'h6']);
});

test('SIP maths reconstructs the target', () => {
  for (const [target, rate, years] of [[1e6, 10, 10], [5e5, 7, 3], [2e7, 12, 25], [1e5, 0.0001, 2]]) {
    const sip = sipNeeded(target, rate, years);
    const i = Math.pow(1 + rate / 100, 1 / 12) - 1; let v = 0;
    for (let m = 0; m < Math.round(years * 12); m++) v = (v + sip) * (1 + i);
    assert.ok(Math.abs(v - target) / target < 1e-6, `${target} ${rate} ${years}`);
  }
  assert.equal(Math.round(fv(100, 10, 2)), 121);
  assert.equal(sipNeeded(0, 10, 5), 0);
});

test('every goal type and horizon produces a sensible plan for every profile level', () => {
  const now = 2026;
  for (const level of [1, 2, 3, 4, 5]) {
    const answers = level === 1 ? lowest : level === 5 ? highest : pick(level - 1);
    for (const type of Object.keys(GOAL_TYPES)) for (const yrs of [0, 1, 2, 4, 6, 9, 15, 25]) {
      const plan = planAll({ profile: answers, goals: [{ type, cost: 1000000, year: now + yrs, years: yrs || 1, saved: 50000, monthly: 50000 }] }, now);
      const g = plan.goals[0];
      assert.ok(cat[g.suggestion.primary], type);
      assert.ok(ASSUMED_RETURN[g.suggestion.primary] !== undefined, 'assumed return for ' + g.suggestion.primary);
      assert.ok(EQUITY_SHARE[g.suggestion.primary] !== undefined, 'equity share for ' + g.suggestion.primary);
      if (type === 'emergency') { assert.equal(g.suggestion.primary, 'liquid'); assert.equal(g.target, 300000); }
      if (GOAL_TYPES[type].purpose === 'goal' && g.years <= 5) assert.ok(risk(g.suggestion.primary) <= 2, `must-have goal in ${g.years}y gets Moderate risk or less: ${g.suggestion.primary}`);
      for (const id of [g.suggestion.primary, ...g.suggestion.alts]) assert.ok(allowedFor(plan.profile.level, id), `level ${plan.profile.level} is never shown ${id}`);
      if (plan.profile.level <= 2) for (const id of [g.suggestion.primary, ...g.suggestion.alts]) assert.ok(risk(id) <= 3, `cautious profile never sees Very High: ${type} ${yrs} ${id}`);
      if (g.sip != null) assert.ok(g.sip >= 0 && Number.isFinite(g.sip));
    }
  }
});

test('goal sizing: inflation, savings and the user\'s own return assumption', () => {
  const p = { level: 3, hasCushion: true };
  const g = planGoal({ type: 'house', cost: 1000000, year: 2031, saved: 0 }, p, 2026);
  assert.equal(Math.round(g.futureCost), Math.round(1000000 * 1.07 ** 5.5), 'goal falls mid-year');
  const g2 = planGoal({ type: 'house', cost: 1000000, year: 2031, saved: 0, rate: 5 }, p, 2026);
  assert.equal(g2.rate, 5); assert.ok(g2.sip > g.sip, 'lower assumed return needs a bigger SIP');
  const g3 = planGoal({ type: 'house', cost: 1000000, year: 2031, saved: 5000000 }, p, 2026);
  assert.equal(g3.sip, 0, 'already saved enough');
});

test('retirement is sized from monthly expenses', () => {
  const g = planGoal({ type: 'retirement', monthly: 50000, year: 2051 }, { level: 3, hasCushion: true }, 2026);
  assert.equal(RETIREMENT_MULTIPLE, 30);
  assert.equal(Math.round(g.futureCost), Math.round(50000 * 12 * 30 * 1.06 ** 25.5));
});

test('share links round-trip, including non-English names, and reject junk', () => {
  const st = { name: 'பாபு Babu', profile: pick(1), goals: [{ id: 'ab12', type: 'education', label: 'Asha – college', cost: 1500000, year: 2040 }] };
  assert.deepEqual(decodeState(encodeState(st)), st);
  assert.equal(decodeState('not-a-real-code!!'), null);
  assert.ok(!/[+/=]/.test(encodeState(st)), 'URL-safe');
});

test('summary text for WhatsApp/email', () => {
  const st = { name: 'Asha', profile: pick(1), goals: [{ type: 'education', cost: 1500000, year: 2040 }, { type: 'emergency', monthly: 40000 }] };
  const plan = planAll(st, 2026);
  const txt = summaryText(st, plan, (id) => cat[id].name, 'https://x/#p/abc');
  assert.match(txt, /Risk profile: /); assert.match(txt, /Child's education \(in 2040/); assert.match(txt, /Liquid Fund/); assert.match(txt, /https:\/\/x\/#p\/abc/);
});

test('a would-be seller is never rated above moderately conservative', () => {
  const bold = { age: 'u30', dependants: '0', income: 'steady', cushion: '6p', emi: 'u20', fall: 'sell', range: 'c', experience: 'long', objective: 'growth' };
  const p = scoreProfile(bold);
  assert.ok(p.level <= 2, 'level ' + p.level); assert.equal(p.mixed, true); assert.equal(p.limitedBy, 'willingness');
  const safe = scoreProfile({ ...bold, fall: 'wait', objective: 'protect' });
  assert.ok(safe.willingnessLevel <= 3);
});

test('each profile level is shown a different, suitable range of funds for long goals', () => {
  const base = { age: 'u30', dependants: '0', income: 'steady', cushion: '6p', emi: 'u20' };
  const lv = { 3: { fall: 'wait', range: 'b', experience: 'some', objective: 'balanced' }, 4: { fall: 'wait', range: 'c', experience: 'long', objective: 'growth' }, 5: { fall: 'buy', range: 'c', experience: 'long', objective: 'growth' } };
  const primaries = {};
  for (const [L, w] of Object.entries(lv)) {
    const plan = planAll({ profile: { ...base, ...w }, goals: [{ type: 'wealth', years: 15 }] }, 2026);
    assert.equal(plan.profile.level, Number(L));
    primaries[L] = plan.goals[0].suggestion.primary;
  }
  assert.notEqual(primaries[3], primaries[4], 'moderate and moderately aggressive differ');
  assert.ok(['aggressive-hybrid', 'daaf', 'large-cap', 'index-etf', 'multi-asset'].includes(primaries[3]), primaries[3]);
});

test('cautious profiles are not steered into ELSS for tax saving', () => {
  const plan = planAll({ profile: { age: '50s', dependants: '3p', income: 'variable', cushion: '3-6', emi: '20-40', fall: 'wait', range: 'a', experience: 'fd', objective: 'income' }, goals: [{ type: 'tax', years: 5, regime: 'old' }] }, 2026);
  assert.ok(plan.profile.level <= 2);
  const g = plan.goals[0];
  assert.notEqual(g.suggestion.primary, 'elss'); assert.ok(!g.suggestion.alts.includes('elss'));
  assert.ok(g.suggestion.notes.includes('n_tax_profile'));
});

test('RISK_OF matches categories.json', () => {
  for (const c of categories) assert.equal(RISK_OF[c.id], RISK.indexOf(c.risk) < 0 ? 5 : RISK.indexOf(c.risk), c.id);
});

test('sizing moves to safer funds for the last 2 years, and grows savings at a safe rate', () => {
  const p = { level: 4, hasCushion: true };
  const g = planGoal({ type: 'education', cost: 1000000, year: 2040 }, p, 2026);
  const months = Math.round(g.years * 12);
  const noGlide = 1000000 * 1.1 ** g.years / sipFactor(months, g.rate, g.rate, 0);
  assert.ok(g.sip > noGlide, 'glide path needs a bigger SIP than all-equity maths');
  assert.equal(g.safeRate, 7);
  const s = planGoal({ type: 'education', cost: 1000000, year: 2040, saved: 100000 }, p, 2026);
  assert.ok(s.gap < g.gap && Math.abs((g.gap - s.gap) - 100000 * 1.07 ** g.years) < 1, 'saved money grows at 7%');
});

test('goals months away are treated as months away', () => {
  const g = planGoal({ type: 'car', cost: 800000, year: 2027 }, { level: 3, hasCushion: true }, 2026.74);
  assert.ok(g.years < 1); assert.equal(g.horizon, 'h1');
});

test('shared links are sanitised: no markup, unknown types dropped, numbers only', () => {
  const evil = { name: '<img src=x onerror=alert(1)>Eve', profile: { age: 'u30', fall: '<script>' }, goals: [
    { id: '"><img src=x>', type: 'emergency', monthly: 50000, months: '<img src=x onerror=alert(1)>' },
    { type: 'zzz', cost: 1 }, { type: 'house', cost: 'abc', year: '2030"><b>', label: '<b>x</b>' }, { type: 'wealth', years: 1e9 } ] };
  const s = decodeState(encodeState(evil));
  assert.ok(!JSON.stringify(s).includes('<'), JSON.stringify(s));
  assert.equal(s.goals.length, 3, 'unknown goal type dropped');
  assert.equal(s.goals[0].months, 6); assert.match(s.goals[0].id, /^[a-z0-9]{1,8}$/);
  assert.equal(s.profile.fall, undefined); assert.equal(s.profile.age, 'u30');
  assert.equal(s.goals[1].cost, undefined); assert.equal(s.goals[1].year, undefined);
  assert.equal(s.goals[2].years, 60);
  assert.equal(sanitizeState(null), null);
  assert.doesNotThrow(() => planAll(s, 2026));
});

test('explanations always describe the fund category actually shown', () => {
  const answers = [lowest, pick(1), pick(2), { ...highest, fall: 'wait', range: 'b' }, highest];
  for (const a of answers) for (const type of Object.keys(GOAL_TYPES)) for (const yrs of [1, 4, 6, 9, 15, 25]) {
    const g = planAll({ profile: a, goals: [{ type, cost: 1e6, year: 2026 + yrs, years: Math.max(3, yrs), monthly: 5e4, regime: 'old' }] }, 2026).goals[0];
    const s = g.suggestion, eq = EQUITY_SHARE[s.primary];
    if (eq < 100) assert.ok(!s.reasons.some((k) => /^r_h_h[56]$/.test(k)), `${type} ${yrs}y ${s.primary}: no "diversified equity" reason for a non-equity fund`);
    if (eq === 0) assert.ok(!s.notes.includes('n_glide'), `${type} ${yrs}y: no glide note when already in debt`);
    if (s.notes.includes('n_lifecycle')) assert.ok([s.primary, ...s.alts].includes('life-cycle'), 'Life Cycle note only when it is shown');
    if (type === 'tax') assert.equal(s.taxBenefit, s.primary === 'elss');
  }
});

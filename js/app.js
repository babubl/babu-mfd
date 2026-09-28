import CONFIG from './config.js';
import {
  RULES, EXPLAIN, ALT_WHY, PROFILE_QUESTIONS, PROFILE_LEVELS, scoreProfile, GOAL_TYPES, ASSUMED_RETURN,
  planAll, encodeState, decodeState, sanitizeState, summaryText, rupees, short, MAX_AMOUNT, RETIREMENT_MULTIPLE,
} from './engine.js';

/* ================= helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const X = (k) => EXPLAIN.en[k] || k;
const NOW = new Date().getFullYear();
const NOWF = NOW + new Date().getMonth() / 12; // fractional year, so goals months away count as months
const isPH = (v) => !v || /^\[.*\]$/.test(String(v).trim());
const digits = (v) => String(v || '').replace(/\D/g, '');
const RISK = ['Low', 'Low to Moderate', 'Moderate', 'Moderately High', 'High', 'Very High'];
const riskIndex = (r) => RISK.indexOf(r);
const GCOL = { equity: 'var(--eq)', debt: 'var(--debt)', hybrid: 'var(--hyb)', lifecycle: 'var(--life)', other: 'var(--oth)', solution: 'var(--oth)' };
const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
};
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); }

/* ================= contact links ================= */
const contact = {
  wa: (text) => isPH(CONFIG.whatsapp) ? null : `https://wa.me/${digits(CONFIG.whatsapp)}?text=${encodeURIComponent(text)}`,
  mail: (subject, body) => isPH(CONFIG.email) ? null : `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  tel: () => isPH(CONFIG.phone) ? null : `tel:+${digits(CONFIG.phone)}`,
  book: () => isPH(CONFIG.booking) ? null : CONFIG.booking,
};
const regLine = () => `AMFI-registered Mutual Fund Distributor · ARN ${esc(CONFIG.arn)}${CONFIG.arnValidTill ? ` (valid till ${esc(CONFIG.arnValidTill)})` : ''} · EUIN ${esc(CONFIG.euin)}`;

/* ================= data ================= */
let CATS = null, SCHEMES = null, schemesP = null, BY_CAT = {};
const cat = (id) => CATS.categories.find((c) => c.id === id);
const grp = (id) => CATS.groups.find((g) => g.id === id);
const ACTIVE = () => CATS.categories.filter((c) => c.status !== 'discontinued');
const loadJson = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
function ensureSchemes() {
  if (!schemesP) schemesP = loadJson('data/schemes.json').then((s) => {
    SCHEMES = s; BY_CAT = {};
    for (const x of s.schemes) if (x.s === 'O') for (const id of x.c || []) (BY_CAT[id] ||= []).push(x);
    return s;
  }).catch(() => null);
  return schemesP;
}

/* ================= plan state (this browser only) ================= */
const KEY = 'mfd-plan-v1';
let STATE = (() => { try { return sanitizeState(JSON.parse(localStorage.getItem(KEY))); } catch { return null; } })() || { name: '', profile: {}, goals: [] };
let STEP = 1;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(STATE)); } catch {} };
const planLink = (st = STATE) => `${location.origin}${location.pathname}#p/${encodeState(st)}`;

/* ================= router ================= */
const VIEWS = { home, learn, planner, plan, funds, services, about, contact: contactView };
function route() {
  const raw = location.hash.slice(1) || 'home';
  let [v, ...rest] = raw.split('/'); const arg = rest.join('/');
  let shared = null;
  if (v === 'p') { shared = decodeState(arg); v = 'plan'; }
  const view = VIEWS[v] ? v : 'home';
  $$('.view').forEach((el) => el.classList.toggle('on', el.id === 'v-' + view));
  $$('.nav a').forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === '#' + view ? 'page' : 'false'));
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  closeDrawer();
  const title = { home: 'Goals first', learn: 'Mutual funds, explained', planner: 'Your goals & risk profile', plan: 'Your goal & risk profile summary', funds: 'Fund types', services: 'For investors', about: 'About & disclosures', contact: 'Talk to me' }[view];
  document.title = `${title} · ${CONFIG.name}`;
  try { if (view === 'plan') plan(shared, v === 'plan' && raw.startsWith('p/')); else VIEWS[view](arg); }
  catch (err) { console.error(err); $('#v-' + view).innerHTML = '<div class="wrap narrow" style="padding:40px 20px"><div class="empty">Something in this page couldn\'t be shown. If you opened a shared link, ask the sender to share it again.</div></div>'; }
  if (!(view === 'funds' && arg)) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('#menuBtn').onclick = () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', o); };

/* ================= chrome ================= */
function paintChrome() {
  $('#brandName').textContent = CONFIG.name;
  $('#mono').textContent = CONFIG.initials || CONFIG.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  $('#brandTag').textContent = `AMFI-registered Mutual Fund Distributor · ARN ${CONFIG.arn}`;
  // Printed pages carry the registration and the standard warning in the page margin, on every page.
  const foot = `${CONFIG.name} · AMFI-registered Mutual Fund Distributor · ARN ${CONFIG.arn} · EUIN ${CONFIG.euin}. Mutual Fund investments are subject to market risks, read all scheme related documents carefully.`;
  const css = (t) => '"' + String(t).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ') + '"';
  const st = document.createElement('style');
  st.textContent = `@media print{@page{@bottom-left{content:${css(foot)};font:7pt/1.3 Jakarta,sans-serif;color:#444;vertical-align:top;padding-top:3mm;border-top:.3pt solid #999}@bottom-right{content:"Page " counter(page) " of " counter(pages);white-space:nowrap;width:22mm;text-align:right;font:7pt Jakarta,sans-serif;color:#444;vertical-align:top;padding-top:3mm;border-top:.3pt solid #999}}}`;
  document.head.appendChild(st);
  $('#footId').innerHTML = `<b style="color:var(--ink)">${esc(CONFIG.name)}</b><br>${regLine()}<br>${esc(CONFIG.city)}<br><span class="tiny">${esc(CONFIG.notAdviser)}</span>`;
  const missing = ['arn', 'arnValidTill', 'euin', 'whatsapp', 'phone', 'email', 'booking', 'bio'].filter((k) => isPH(CONFIG[k]));
  const bar = $('#previewBar');
  if (missing.length) { bar.hidden = false; bar.innerHTML = `<b>Preview.</b> Add your ${missing.map((m) => ({ arn: 'ARN', arnValidTill: 'ARN validity', euin: 'EUIN', whatsapp: 'WhatsApp number', phone: 'phone', email: 'email', booking: 'booking link', bio: 'bio' }[m])).join(', ')} in <code>js/config.js</code> before sharing this site.`; }
}

/* ================= shared UI ================= */
function meterSVG(level, label) {
  const cx = 100, cy = 100, R = 88, r = 56; let paths = '';
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i / 6) * Math.PI + .014, a1 = Math.PI + ((i + 1) / 6) * Math.PI - .014;
    const p = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    paths += `<path d="M${p(a0, R)} A${R} ${R} 0 0 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 0 0 ${p(a0, r)}Z" fill="var(--r${i + 1})" opacity="${level < 0 || i === level ? 1 : .25}"/>`;
  }
  const ang = level < 0 ? -90 : -90 + ((level + .5) / 6) * 180;
  return `<svg viewBox="0 0 200 112" role="img" aria-label="Riskometer${label ? ': ' + esc(label) : ''}" style="width:100%;max-width:230px;display:block;margin:0 auto">${paths}<g transform="rotate(${ang} 100 100)"><path d="M97 100 L100 28 L103 100Z" fill="var(--ink)"/></g><circle cx="100" cy="100" r="7" fill="var(--ink)"/></svg>${label ? `<div style="text-align:center;font-weight:800;margin-top:2px">${esc(label)}</div>` : ''}`;
}
const risk6 = (r) => { const i = riskIndex(r); return `<span class="risk6" aria-label="${esc(r)} risk">${[0, 1, 2, 3, 4, 5].map((k) => `<i style="${k <= i ? `background:var(--r${k + 1})` : ''}"></i>`).join('')}</span>`; };
function contactButtons(text, subject, opts = {}) {
  const wa = contact.wa(text), m = contact.mail(subject, text), t = contact.tel(), b = contact.book();
  const cls = opts.light ? '' : 'ghost';
  return `<div class="row">
    ${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">${ICON.chat}${opts.waLabel || 'WhatsApp me'}</a>` : `<button class="btn" type="button" disabled aria-describedby="waHelp">${ICON.chat}${opts.waLabel || 'WhatsApp me'}</button><span id="waHelp" class="sr">WhatsApp number not added yet</span>`}
    ${m ? `<a class="btn ${cls}" href="${esc(m)}">${ICON.mail}Email</a>` : ''}
    ${t ? `<a class="btn ${cls}" href="${esc(t)}">${ICON.phone}Call</a>` : ''}
    ${b ? `<a class="btn ${cls}" href="${esc(b)}" target="_blank" rel="noopener">${ICON.cal}Book a call</a>` : ''}
  </div>`;
}

/* ================= HOME ================= */
const SAMPLE = { name: 'Priya', profile: { age: '30s', dependants: '1-2', income: 'steady', cushion: '3-6', emi: '20-40', fall: 'wait', range: 'b', experience: 'some', objective: 'balanced' },
  goals: [{ type: 'emergency', label: 'Emergency fund', monthly: 50000, months: 6, saved: 150000 }, { type: 'education', label: 'Daughter\'s college', cost: 1500000, year: NOW + 14, saved: 100000 }, { type: 'house', label: 'Home down payment', cost: 1500000, year: NOW + 4 }] };
function home() {
  const sp = planAll(SAMPLE, NOWF);
  const rows = sp.goals.map((g) => { const c = cat(g.suggestion.primary); return `<tr><td><span class="gdot" style="background:${GCOL[c.group]}"></span>${esc(g.goal.label)}<br><span class="tiny">${g.goal.type === 'emergency' ? 'Keep ready' : 'By ' + g.goal.year} · ${esc(c.name)}</span></td><td>${g.sip ? rupees(g.sip) + '<span class="tiny"> /mo</span>' : short(g.gap || 0)}</td></tr>`; }).join('');
  const hasPlan = scoreProfile(STATE.profile).complete && STATE.goals.length;
  $('#v-home').innerHTML = `
  <div class="wrap">
    <div class="hero">
      <div>
        <div class="eyebrow">Mutual fund distribution · ${esc(CONFIG.city)}</div>
        <h1 style="margin-top:12px">Start with your goals,<br>not a tip.</h1>
        <p class="lede">Before we talk about any fund, let's understand what your money is for. Set out your goals and risk profile in about 10 minutes, and I'll review them before we speak.</p>
        <div class="row">
          <a class="btn" href="#planner">${hasPlan ? 'Continue where I left off' : 'Start with my goals'}</a>
          <a class="btn ghost" href="#learn">Learn the basics first</a>
        </div>
        <div class="trust">
          <span>${ICON.shield}AMFI-registered · ARN ${esc(CONFIG.arn)}</span>
          <span>${ICON.lock}Your answers stay on your device</span>
          <span>${ICON.eye}Commissions disclosed upfront</span>
        </div>
      </div>
      <div class="sheet" aria-label="Sample goal summary">
        <div class="sh"><div><small>Goal &amp; risk profile summary</small><b>${esc(SAMPLE.name)}</b><div class="small muted">Risk profile: ${esc(sp.profile.name)}</div></div><span class="tag">Sample</span></div>
        <table>${rows}</table>
        <div class="sf"><span>Monthly investment for dated goals</span><b>${rupees(sp.monthlyNeeded)}</b></div>
        <div style="padding:0 22px 20px"><div class="mixbar"><i style="width:${sp.equity}%;background:var(--eq)"></i><i style="width:${100 - sp.equity}%;background:var(--debt)"></i></div><div class="tiny" style="margin-top:6px">About ${sp.equity}% in equity and ${100 - sp.equity}% in debt across the plan</div></div>
      </div>
    </div>
  </div>
  <section class="block alt"><div class="wrap">
    <div class="head"><h2>How we'll work together</h2><p>A distributor's job is to match funds to your needs, not the other way round. So we start with you.</p></div>
    <ol class="steps">
      <li class="card"><h3>Understand the basics</h3><p class="muted">A 10-minute plain-language guide: how funds work, the main types, costs and risks. No jargon.</p><a href="#learn" class="small" style="font-weight:700">Read the guide</a></li>
      <li class="card"><h3>Set out your goals</h3><p class="muted">Answer nine questions about your situation and comfort with risk, then add your goals. You get a written summary: your risk profile, the fund category that generally fits each goal, and an estimate of what each goal needs.</p><a href="#planner" class="small" style="font-weight:700">Start now</a></li>
      <li class="card"><h3>Talk it through with me</h3><p class="muted">Send me your summary. I'll review it, suggest schemes I distribute that suit it, tell you what I earn on each, and help you with KYC and investing.</p><a href="#contact" class="small" style="font-weight:700">Ways to reach me</a></li>
    </ol>
  </div></section>
  <section class="block"><div class="wrap">
    <div class="head"><h2>What you can expect from me</h2></div>
    <div class="principles">
      <div>${ICON.map}<p style="margin:0"><b>Goals before products.</b> <span class="muted">Every fund I suggest is tied to a goal, a date and your risk profile.</span></p></div>
      <div>${ICON.scale}<p style="margin:0"><b>Suitability first.</b> <span class="muted">If a fund doesn't suit your timeline or comfort with risk, I won't suggest it, however popular it is.</span></p></div>
      <div>${ICON.eye}<p style="margin:0"><b>Open about costs.</b> <span class="muted">I'm paid a trail commission by fund houses through Regular plans. I'll tell you what I earn on any scheme I suggest.</span></p></div>
      <div>${ICON.ban}<p style="margin:0"><b>No tips, no guarantees.</b> <span class="muted">No one can promise mutual fund returns. I won't, and I won't chase last year's top performer.</span></p></div>
      <div>${ICON.cal}<p style="margin:0"><b>Reviews, not churn.</b> <span class="muted">We review once a year and when your life changes, not every time the market moves.</span></p></div>
      <div>${ICON.lock}<p style="margin:0"><b>Your money goes straight to the fund.</b> <span class="muted">Payments go directly to the fund house, and units are held in your name. I never handle your money.</span></p></div>
    </div>
  </div></section>
  <section class="block alt"><div class="wrap narrow">
    <div class="head"><h2>Common questions</h2></div>
    ${faq([
      ['What does it cost me to work with you?', 'Nothing directly. I\'m paid a trail commission by the fund house, which comes out of the Regular plan\'s yearly expense ratio rather than as a fee from you. It varies by scheme, and I\'ll tell you the exact commission on every scheme I suggest before you invest.'],
      ['Why not invest directly on my own?', 'You can. Direct plans cost less because no distributor is paid. What you get through me is help choosing suitable funds, handling paperwork and KYC, staying disciplined when markets fall, and yearly reviews. If you\'re confident doing that yourself, Direct plans may suit you better, and I\'ll say so.'],
      ['How much do I need to start?', 'Many funds accept a monthly SIP from ₹500, and some from ₹100. What matters more is having an emergency fund first and matching each goal to the right kind of fund.'],
      ['Is my money safe with a distributor?', 'Your payment goes directly from your bank to the fund house, and units are held in your name with the registrar. A distributor never receives your investment money. Mutual funds are regulated by SEBI, but their value can still fall with the markets.'],
      ['What documents do I need?', 'For KYC: PAN, Aadhaar (with your mobile number linked for the OTP), a photo and your email. To invest you\'ll also need bank account proof, such as a cancelled cheque or statement, and your nominee\'s details. KYC is done once and works across all fund houses.'],
      ['Can I stop or withdraw anytime?', 'Yes. You can stop a SIP whenever you want, and redeem from open-ended funds on any working day. Some funds charge a small exit load if you sell within a set period, and ELSS has a 3-year lock-in.'],
      ['Is this financial planning or investment advice?', 'No. I\'m a mutual fund distributor. The goal summary helps us both see what your money is for and how much risk it can take, so I can suggest suitable schemes I distribute. For comprehensive financial planning or fee-based investment advice, you would need a SEBI-registered investment adviser.'],
    ])}
  </div></section>
  <section class="block"><div class="wrap">
    <div class="cta-box"><h2>Start with your goals</h2><p>Ten minutes now saves a lot of guesswork later. Your answers stay on your device until you choose to share them.</p><div class="row" style="margin-top:16px"><a class="btn" href="#planner">Start with my goals</a><a class="btn ghost" href="#contact">Or just talk to me</a></div></div>
  </div></section>`;
}
const faq = (items) => items.map(([q, a]) => `<details class="qa"><summary>${esc(q)}</summary><div class="a">${esc(a)}</div></details>`).join('');

/* ================= LEARN ================= */
const LEARN = [
  ['what', 'What a mutual fund is', `<p>A mutual fund pools money from many investors and invests it in shares, bonds, gold or a mix, following an objective written down before the fund starts. A professional team manages it.</p><div class="key">You don't buy a separate "mutual fund" asset. You own shares, bonds or gold <i>through</i> the fund, in small pieces called units.</div><p>If the investments grow, your units are worth more; if they fall, your units are worth less. Everyone else involved, from the fund house to the distributor, earns only a fee.</p>`],
  ['safe', 'Who looks after your money', `<dl class="kv"><dt>Fund house (AMC)</dt><dd>Decides what to buy and sell.</dd><dt>Trustees</dt><dd>Oversee the fund house on investors' behalf.</dd><dt>Custodian</dt><dd>Holds the actual shares and bonds, separately from the fund house.</dd><dt>Registrar (CAMS or KFintech)</dt><dd>Keeps your records and sends your statements.</dd><dt>SEBI</dt><dd>The regulator that sets the rules for all of them.</dd><dt>AMFI</dt><dd>The industry association. It registers distributors like me.</dd></dl><p>Because of this split, trouble at a fund house doesn't make your investments disappear. It doesn't protect you from market falls, though.</p>`],
  ['nav', 'NAV: the price of one unit', `<p>NAV (net asset value) is the value of one unit, worked out every business day from the market value of everything the fund holds, after its costs. You buy and sell units at the NAV: invest ₹10,000 at a NAV of ₹50 and you get 200 units.</p><div class="key">A low NAV doesn't make a fund cheap, and a high NAV doesn't make it expensive. A high NAV usually just means the fund is older and has grown.</div>`],
  ['types', 'Equity, debt and hybrid', `<dl class="kv"><dt style="color:var(--eq)">Equity funds</dt><dd>Own company shares. The highest long-term growth, but they can fall 30–50% in a bad year. Give them 5 years or more.</dd><dt style="color:var(--debt)">Debt funds</dt><dd>Lend to governments, banks and companies for interest. Steadier, with lower returns. For emergency money and goals a few years away.</dd><dt style="color:var(--hyb)">Hybrid funds</dt><dd>Mix both, sometimes with gold, for a smoother ride than pure equity.</dd></dl><div class="key">The closer your goal, the less of that money should be in shares.</div><p>SEBI allows ${'{{N}}'} fund types, so a "large cap fund" means the same thing at every fund house. <a href="#funds">See all the fund types</a>.</p>`],
  ['debt', 'Debt funds, simply', `<p>Debt funds earn interest by lending. Two things decide how bumpy they are:</p><dl class="kv"><dt>How long they lend for</dt><dd>Called <b>duration</b>. When interest rates rise, existing bonds lose value, and the longer a fund lends for, the bigger the drop. Short duration means small ups and downs.</dd><dt>Who they lend to</dt><dd>Called <b>credit quality</b>. The government and top-rated borrowers almost always repay. Lower-rated ones pay more but may not repay.</dd></dl><div class="key">Match duration to your timeline: a fund lending for 1–3 years suits a goal 1–3 years away.</div>`],
  ['risk', 'Reading the riskometer', `<div style="max-width:240px;margin:6px auto 10px">{{METER}}</div><p>Every fund shows a riskometer with six levels, from Low to Very High, reviewed every month from what the fund actually holds. Nearly every equity fund sits at Very High. That isn't a warning to avoid equity; it tells you the value swings a lot and needs time.</p>`],
  ['sip', 'SIP, lumpsum, STP and SWP', `<dl class="kv"><dt>SIP</dt><dd>A fixed amount every month. When prices fall, the same amount buys more units. It builds a habit and removes the worry of timing.</dd><dt>Lumpsum</dt><dd>All at once. Fine for debt funds; for equity, spreading it out often feels easier.</dd><dt>STP</dt><dd>Park a lumpsum in a liquid fund and move a fixed amount into equity each month.</dd><dt>SWP</dt><dd>Withdraw a fixed amount regularly, for example as income in retirement.</dd></dl><p>You can pause, change or stop a SIP at any time.</p>`],
  ['options', 'Growth or IDCW', `<p><b>Growth:</b> gains stay invested and compound. Suits building wealth.</p><p><b>IDCW</b> (formerly "dividend"): the fund pays out money now and then.</p><div class="key">An IDCW payout isn't a bonus. It's your own money coming back, and the NAV falls by the same amount.</div>`],
  ['plans', 'Direct and Regular plans', `<p>Every fund has two plans holding exactly the same investments.</p><dl class="kv"><dt>Direct plan</dt><dd>Bought straight from the fund house or an investing app. Lower yearly cost, because no distributor is paid. You choose and manage on your own.</dd><dt>Regular plan</dt><dd>Bought through a mutual fund distributor, who is paid a trail commission from the fund's yearly cost. You get help choosing, paperwork, and reviews.</dd></dl><p>As a distributor, I work with Regular plans, and I'll always tell you what I earn. Choose whichever way suits you.</p>`],
  ['costs', 'What a fund costs', `<dl class="kv"><dt>Expense ratio</dt><dd>A yearly cost as a % of your investment, taken a little every day. The NAV you see is already after it.</dd><dt>Exit load</dt><dd>A small charge if you sell too soon, often 1% within a year. Check the period before you invest.</dd><dt>Entry load</dt><dd>Not allowed. No one can charge you to invest.</dd></dl>`],
  ['tax', 'Tax, in brief', `<p>You pay tax on gains when you sell, not every year. For equity-oriented funds, holding for more than 12 months lowers the tax. Gains on most debt funds bought after 1 April 2023 are taxed at your income-tax slab rate, however long you hold them.</p><p>ELSS funds qualify for the tax-saving deduction of up to ₹1.5 lakh a year, only under the old tax regime. From 1 April 2026 this is Section 123 of the Income-tax Act, 2025 (formerly Section 80C).</p><p class="muted small">Tax rules change with Budgets. Check the current rules, or ask a tax professional about your situation.</p>`],
  ['start', 'How investing with me works', `<ol class="escalate" style="margin-top:4px"><li><div><b>Basics first.</b> An emergency fund of 3–6 months of expenses, term insurance if anyone depends on you, and health insurance.</div></li><li><div><b>Set out your goals</b> on this site and send me the summary.</div></li><li><div><b>We discuss it.</b> I suggest schemes I distribute for each goal and tell you what I earn on each.</div></li><li><div><b>KYC, once.</b> PAN and Aadhaar (with your mobile linked), done online in minutes. If your KYC shows as "registered" rather than "validated", it may need a quick re-verification.</div></li><li><div><b>You invest.</b> Your money goes straight from your bank to the fund house. Units are held in your name.</div></li><li><div><b>We review yearly</b>, and move money to safer funds as each goal comes close.</div></li></ol>`],
];
const MYTHS = [
  ['Mutual funds guarantee returns.', 'No mutual fund can promise returns. Even debt funds can lose money.'],
  ['A fund with a lower NAV is cheaper.', 'NAV says nothing about value; growth from here is what counts.'],
  ['Debt funds can never lose money.', 'Bond prices move with interest rates, and borrowers can default.'],
  ['Last year\'s top fund is the best buy.', 'Top performers change often. Consistency over 5+ years and fit with your goal matter more.'],
  ['A SIP means you can\'t lose money.', 'A SIP spreads out your buying, but the investments can still fall.'],
  ['You need a demat account for mutual funds.', 'Only for ETFs. Regular mutual funds don\'t need one.'],
];
function learn() {
  const body = LEARN.map(([id, t, h], i) => `<section id="l-${id}"><div class="tiny" style="font-weight:700">${i + 1} of ${LEARN.length}</div><h2>${esc(t)}</h2>${h.replace('{{N}}', ACTIVE().length).replace('{{METER}}', meterSVG(-1, ''))}</section>`).join('');
  $('#v-learn').innerHTML = `<div class="wrap"><div class="learn">
    <nav class="toc" aria-label="On this page">${LEARN.map(([id, t]) => `<a href="#learn" data-to="l-${id}">${esc(t)}</a>`).join('')}<a href="#learn" data-to="l-myths">Six common myths</a></nav>
    <div class="article">
      <div class="eyebrow">A 10-minute guide</div><h1 style="font-size:clamp(2rem,4.5vw,2.8rem);margin:10px 0 18px">Mutual funds, explained plainly</h1>
      <p class="muted" style="font-size:1.1rem;margin-bottom:34px">Everything you need before choosing a fund, without the jargon. Read it in one go or jump to a topic.</p>
      ${body}
      <section id="l-myths"><h2>Six common myths</h2>${faq(MYTHS.map(([m, a]) => ['Myth: ' + m, a]))}</section>
      <div class="cta-box"><h2>Ready to start?</h2><p>Put this into practice with your own goals. It takes about 10 minutes.</p><div class="row" style="margin-top:14px"><a class="btn" href="#planner">Start with my goals</a></div></div>
    </div></div></div>`;
  const toc = $$('.toc a');
  toc.forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.dataset.to)?.scrollIntoView({ behavior: 'smooth' }); });
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) toc.forEach((a) => a.classList.toggle('on', a.dataset.to === en.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
  $$('.article section').forEach((s) => io.observe(s));
}

/* ================= PLANNER ================= */
function planner() {
  const el = $('#v-planner');
  const prof = scoreProfile(STATE.profile);
  const stepper = `<ol class="stepper" aria-label="Progress">${['About you', 'Your goals', 'Your summary'].map((s, i) => `<li class="${STEP === i + 1 ? 'on' : STEP > i + 1 ? 'done' : ''}" ${STEP === i + 1 ? 'aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`;
  if (STEP === 1) {
    const q = (x) => `<fieldset class="q"><legend>${esc(x.q)}</legend><div class="choices">${x.options.map(([v, l]) => `<label class="choice"><input type="radio" name="${x.id}" value="${v}" ${STATE.profile[x.id] === v ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>`;
    const answered = PROFILE_QUESTIONS.filter((x) => STATE.profile[x.id]).length;
    el.innerHTML = `<div class="wrap narrow planner">${stepper}
      <h1 style="font-size:clamp(1.9rem,4vw,2.5rem)">About you</h1>
      <p class="muted" style="font-size:1.05rem">Nine questions. The first five look at your <b>ability</b> to take risk; the last four at your <b>willingness</b>. Your profile is the more careful of the two.</p>
      <div class="field" style="max-width:360px;margin-top:18px"><label for="pname">Your name <span class="dim">(optional, shown on your summary)</span></label><input class="input" id="pname" maxlength="60" autocomplete="given-name" value="${esc(STATE.name)}"></div>
      <div class="part"><h3>Your situation</h3><span class="tiny">Ability to take risk</span></div>
      ${PROFILE_QUESTIONS.filter((x) => x.part === 'ability').map(q).join('')}
      <div class="part" style="margin-top:26px"><h3>Your comfort with risk</h3><span class="tiny">Willingness to take risk</span></div>
      ${PROFILE_QUESTIONS.filter((x) => x.part === 'willingness').map(q).join('')}
      <div class="navrow"><a class="btn ghost" href="#home">Cancel</a><button class="btn" type="button" id="next1" ${prof.complete ? '' : 'disabled'}>Next: your goals</button></div>
      <p class="tiny" style="text-align:right;margin-top:8px" id="left1">${prof.complete ? '' : `${PROFILE_QUESTIONS.length - answered} question${PROFILE_QUESTIONS.length - answered === 1 ? '' : 's'} left`}</p></div>`;
    el.oninput = (e) => {
      if (e.target.id === 'pname') { STATE.name = e.target.value.trim(); save(); return; }
      if (e.target.type === 'radio') {
        STATE.profile[e.target.name] = e.target.value; save();
        const p = scoreProfile(STATE.profile), left = PROFILE_QUESTIONS.filter((x) => !STATE.profile[x.id]).length;
        $('#next1').disabled = !p.complete; $('#left1').textContent = left ? `${left} question${left === 1 ? '' : 's'} left` : '';
      }
    };
    $('#next1').onclick = () => { STEP = 2; planner(); window.scrollTo(0, 0); };
    return;
  }
  if (STEP === 2) {
    el.innerHTML = `<div class="wrap planner" style="max-width:980px">${stepper}
      <h1 style="font-size:clamp(1.9rem,4vw,2.5rem)">Your goals</h1>
      <p class="muted" style="font-size:1.05rem">Add each thing you're saving for. Amounts are in today's money; the plan adjusts them for rising prices.</p>
      <h3 style="margin:22px 0 10px">Add a goal</h3>
      <div class="goaltypes">${Object.entries(GOAL_TYPES).map(([k, t]) => `<button class="gt" type="button" data-add="${k}"><span class="e" aria-hidden="true">${t.icon}</span><span>${esc(t.n)}</span></button>`).join('')}</div>
      <div id="goalList"></div>
      <div class="navrow"><button class="btn ghost" type="button" id="back2">Back</button><button class="btn" type="button" id="next2">See my summary</button></div>
      <p class="tiny" style="text-align:right;margin-top:8px" id="err2"></p></div>`;
    drawGoals();
    el.oninput = null;
    $$('[data-add]').forEach((b) => b.onclick = () => {
      const type = b.dataset.add, t = GOAL_TYPES[type];
      const g = { id: Math.random().toString(36).slice(2, 8), type, label: t.n };
      if (type === 'emergency') g.months = 6;
      if (type === 'tax') { g.regime = 'old'; g.years = 5; }
      if (type === 'retirement') g.label = 'Retirement';
      if (type === 'wealth') g.years = 10;
      STATE.goals.push(g); save(); drawGoals();
      document.querySelector(`[data-goal="${g.id}"] input`)?.focus();
    });
    $('#back2').onclick = () => { STEP = 1; planner(); window.scrollTo(0, 0); };
    $('#next2').onclick = () => {
      const bad = STATE.goals.map(goalProblem).filter(Boolean);
      if (!STATE.goals.length) { $('#err2').textContent = 'Add at least one goal to see your summary.'; return; }
      if (bad.length) { $('#err2').textContent = bad[0]; return; }
      STEP = 1; location.hash = 'plan';
    };
    return;
  }
}
function goalProblem(g) {
  const n = g.label || GOAL_TYPES[g.type].n;
  for (const k of ['cost', 'saved', 'monthly', 'sipNow']) if (Number(g[k]) > MAX_AMOUNT) return `${n}: amounts above ₹100 crore aren't supported here. Let's discuss this directly.`;
  if (g.type === 'emergency') return Number(g.monthly) > 0 ? '' : `${n}: add your monthly expenses.`;
  if (g.type === 'tax') return Number(g.years) >= 3 ? '' : `${n}: tax-saving funds lock money for 3 years, so enter 3 years or more.`;
  if (g.type === 'wealth') return Number(g.years) >= 1 ? '' : `${n}: add how many years.`;
  if (g.type === 'retirement') return Number(g.monthly) > 0 && Number(g.year) > NOW ? '' : `${n}: add your monthly expenses and retirement year.`;
  return Number(g.cost) > 0 && Number(g.year) > NOW ? '' : `${n}: add the cost and a target year after ${NOW}.`;
}
const moneyField = (g, key, label, hint = '') => `<div class="field"><label for="${g.id}-${key}">${label}</label><div class="money"><input class="input" id="${g.id}-${key}" data-k="${key}" inputmode="numeric" autocomplete="off" value="${g[key] ? Number(g[key]).toLocaleString('en-IN') : ''}"></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const numField = (g, key, label, attrs = '', hint = '') => `<div class="field"><label for="${g.id}-${key}">${label}</label><input class="input" id="${g.id}-${key}" data-k="${key}" type="number" inputmode="numeric" ${attrs} value="${g[key] ?? ''}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
function drawGoals() {
  const box = $('#goalList');
  if (!STATE.goals.length) { box.innerHTML = '<div class="empty" style="margin-top:18px">No goals yet. Start with an emergency fund if you don\'t have one; then add what you\'re saving for.</div>'; return; }
  box.innerHTML = STATE.goals.map((g) => {
    const t = GOAL_TYPES[g.type];
    let f = `<div class="field"><label for="${g.id}-label">Name</label><input class="input" id="${g.id}-label" data-k="label" maxlength="40" value="${esc(g.label || '')}"></div>`;
    if (g.type === 'emergency') f += moneyField(g, 'monthly', 'Monthly household expenses') + `<div class="field"><label for="${g.id}-months">Months to keep</label><select class="input" id="${g.id}-months" data-k="months">${[3, 6, 9, 12].map((m) => `<option value="${m}" ${Number(g.months) === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>` + moneyField(g, 'saved', 'Already set aside');
    else if (g.type === 'retirement') f += moneyField(g, 'monthly', 'Monthly expenses today', `Sized as about ${RETIREMENT_MULTIPLE} years of expenses`) + numField(g, 'year', 'Retirement year', `min="${NOW + 1}" max="${NOW + 45}"`) + moneyField(g, 'saved', 'Already saved for it', 'EPF, PPF, NPS or funds');
    else if (g.type === 'wealth') f += numField(g, 'years', 'Years you can stay invested', 'min="1" max="40"') + moneyField(g, 'sipNow', 'Monthly amount you plan', 'Optional');
    else if (g.type === 'tax') f += `<div class="field"><label for="${g.id}-regime">Tax regime</label><select class="input" id="${g.id}-regime" data-k="regime">${[['old', 'Old regime'], ['new', 'New regime'], ['unsure', 'Not sure']].map(([v, l]) => `<option value="${v}" ${g.regime === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` + numField(g, 'years', 'Years you\'ll stay invested', 'min="3" max="40"', 'At least 3 (the lock-in)');
    else f += moneyField(g, 'cost', 'Cost in today\'s money') + numField(g, 'year', 'Target year', `min="${NOW + 1}" max="${NOW + 40}"`) + moneyField(g, 'saved', 'Already saved for it', 'Optional');
    const adv = ['emergency', 'tax'].includes(g.type) ? '' : `<details><summary>Adjust assumptions</summary><div class="fields" style="margin-top:12px">${g.type !== 'wealth' ? numField(g, 'inflation', 'Price rise per year (%)', 'step="0.5" min="0" max="20"', `Default ${t.inflation}%`) : ''}${numField(g, 'rate', 'Assumed return per year (%)', 'step="0.5" min="1" max="20"', 'Default depends on the fund type')}</div><p class="tiny">These are planning assumptions, not promises. Actual returns will be different.</p></details>`;
    return `<div class="card goal" data-goal="${g.id}"><div class="gh"><h3><span aria-hidden="true">${t.icon}</span>${esc(t.n)}</h3><button class="link small" type="button" data-del="${g.id}">Remove</button></div><div class="fields">${f}</div>${adv}<div class="preview-line" aria-live="polite"></div></div>`;
  }).join('');
  STATE.goals.forEach(goalPreview);
  box.oninput = (e) => {
    const card = e.target.closest('[data-goal]'); if (!card) return;
    const g = STATE.goals.find((x) => x.id === card.dataset.goal); const k = e.target.dataset.k; if (!g || !k) return;
    if (e.target.closest('.money')) { const n = Math.min(parseInt(e.target.value.replace(/\D/g, '').slice(0, 13), 10) || 0, MAX_AMOUNT * 10); g[k] = n; e.target.value = n ? n.toLocaleString('en-IN') : ''; }
    else g[k] = e.target.type === 'number' ? e.target.value : e.target.value;
    save(); goalPreview(g); $('#err2').textContent = '';
  };
  box.onclick = (e) => { const d = e.target.closest('[data-del]'); if (!d) return; STATE.goals = STATE.goals.filter((x) => x.id !== d.dataset.del); save(); drawGoals(); };
}
function goalPreview(g) {
  const line = document.querySelector(`[data-goal="${g.id}"] .preview-line`); if (!line) return;
  if (goalProblem(g)) { line.textContent = 'Fill in the details to see the fund type and amount.'; return; }
  const p = planAll({ profile: STATE.profile, goals: [g] }, NOWF).goals[0], c = cat(p.suggestion.primary);
  let s = `Fund category that generally fits: <b>${esc(c.name)}</b>`;
  if (g.type === 'emergency') s += ` · target ${short(p.target)}${p.gap ? `, ${short(p.gap)} still to set aside` : ', fully covered'}`;
  else if (p.futureCost) s += ` · needs about <b>${short(p.futureCost)}</b> by ${esc(g.year)} · about <b>${rupees(p.sip)}</b> a month (estimate)`;
  line.innerHTML = s;
}

/* ================= PLAN (report) ================= */
function plan(shared, isShared) {
  const el = $('#v-plan');
  if (isShared && !shared) { el.innerHTML = `<div class="wrap narrow report"><div class="empty">This link is incomplete or damaged. Ask the sender to share it again.</div></div>`; return; }
  let st = shared || STATE, dropped = 0;
  if (isShared) { const ok = st.goals.filter((g) => !goalProblem(g)); dropped = st.goals.length - ok.length; st = { ...st, goals: ok }; }
  const prof = scoreProfile(st.profile);
  if (isShared && (!prof.complete || !st.goals.length)) { el.innerHTML = `<div class="wrap narrow report"><div class="empty">This summary is out of date or incomplete${dropped ? ' (its goal dates have passed or details are missing)' : ''}. Ask the sender to update their answers and share it again.</div></div>`; return; }
  if (!prof.complete || !st.goals.length || st.goals.some(goalProblem)) {
    el.innerHTML = `<div class="wrap narrow report"><h1 style="font-size:2rem">Your goal &amp; risk profile summary</h1><p class="muted">Your summary appears here once you've answered the profile questions and added at least one goal.</p><div class="row" style="margin-top:16px"><a class="btn" href="#planner">Start with my goals</a></div></div>`;
    return;
  }
  const P = planAll(st, NOWF);
  const link = planLink(st);
  const msg = summaryText(st, P, (id) => cat(id).name, link);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const lv = P.profile.level;
  const limit = { ability: 'your financial situation (ability), which is more cautious than your comfort with risk', willingness: 'your comfort with risk (willingness), which is more cautious than your financial situation', both: 'both your finances and your comfort with risk, which agree' }[P.profile.limitedBy];
  const whenTxt = (g) => g.goal.type === 'emergency' ? 'Keep ready' : g.goal.type === 'wealth' || g.goal.type === 'tax' ? `${Math.round(g.years)} years` : `${g.goal.year} (${Math.round(g.years)} yrs)`;
  const rows = P.goals.map((g) => { const c = cat(g.suggestion.primary);
    return `<tr><td><b>${esc(g.goal.label || g.type.n)}</b>${g.goal.label && g.goal.label !== g.type.n ? `<br><span class="tiny">${esc(g.type.n)}</span>` : ''}</td><td data-l="When">${esc(whenTxt(g))}</td><td data-l="Amount needed" class="n">${g.goal.type === 'emergency' ? short(g.target) + `<br><span class="tiny">${g.gap ? short(g.gap) + ' still to set aside' : 'fully set aside'}</span>` : g.futureCost ? short(g.futureCost) : '–'}</td><td data-l="Fund category"><span class="gdot" style="background:${GCOL[c.group]}"></span>${esc(c.name)}${g.suggestion.taxBenefit === false ? '<br><span class="tiny">No tax benefit; see note</span>' : ''}</td><td data-l="Monthly SIP (est.)" class="n">${g.goal.type === 'emergency' ? '–' : g.sip != null ? rupees(g.sip) : g.goal.sipNow ? rupees(g.goal.sipNow) + '<br><span class="tiny">your amount</span>' : '–'}</td></tr>`; }).join('');
  el.innerHTML = `<div class="wrap report"><div class="doc">
    ${isShared ? `<div class="note no-print" style="margin-bottom:20px">You're viewing a shared summary. <button class="link" type="button" id="adopt">Save it on this device</button> to edit it.${dropped ? ` ${dropped} goal${dropped > 1 ? 's were' : ' was'} left out because ${dropped > 1 ? 'their dates have' : 'its date has'} passed or details are missing.` : ''}</div>` : ''}
    <div class="doc-head"><div><div class="eyebrow">Goal &amp; risk profile summary</div><h1 style="margin-top:6px">${st.name ? esc(st.name) : 'Your summary'}</h1></div>
      <div class="doc-meta">Prepared ${date}<br>With ${esc(CONFIG.name)}, ${regLine()}</div></div>
    <p class="note" style="margin-top:16px">Prepared by a mutual fund distributor as part of distribution services. It is not financial planning or investment advice under the SEBI (Investment Advisers) Regulations, 2013, and not a recommendation of any scheme.</p>

    <h2>Your investor profile</h2>
    <div class="profilebox">
      <div class="card pad"><div class="tiny" style="font-weight:800">Risk profile</div><div style="font-size:1.6rem;font-weight:800;letter-spacing:-.02em">${esc(P.profile.name)}</div>
        <div class="scale" aria-label="Level ${lv} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</div><div class="scale-l"><span>Conservative</span><span>Aggressive</span></div>
        <p class="small muted" style="margin-top:12px">${esc(P.profile.limitedBy === 'ability' && PROFILE_LEVELS[lv].da ? PROFILE_LEVELS[lv].da : PROFILE_LEVELS[lv].d)}</p></div>
      <div class="card pad"><div class="meters">
        <div class="m"><span>Ability</span><span class="bar"><b style="width:${P.profile.abilityLevel * 20}%"></b></span><span>${P.profile.abilityLevel}/5</span></div>
        <div class="m"><span>Willingness</span><span class="bar"><b style="width:${P.profile.willingnessLevel * 20}%"></b></span><span>${P.profile.willingnessLevel}/5</span></div>
        <div class="m"><span>Your profile</span><span class="bar"><b style="width:${lv * 20}%;background:var(--brand)"></b></span><span>${lv}/5</span></div></div>
        <p class="small muted" style="margin-top:14px">Your profile follows ${limit}. Each goal's own timeline then decides how much risk that money can take.</p>
        ${P.profile.mixed ? `<div class="note">${esc(X('n_mixed'))}</div>` : ''}
        ${st.profile.cushion === 'u3' ? `<div class="note warn">${esc(X('w_no_emergency'))}</div>` : ''}</div>
    </div>

    <h2>Your goals at a glance</h2>
    <div class="card" style="padding:4px 12px;overflow:hidden"><table class="plan"><thead><tr><th>Goal</th><th>When</th><th class="n">Amount needed</th><th>Fund category that generally fits</th><th class="n">Monthly SIP (est.)</th></tr></thead><tbody>${rows}</tbody>
      ${P.monthlyNeeded ? `<tfoot><tr><td colspan="4">Estimated monthly investment for dated goals</td><td class="n" data-l="Total">${rupees(P.monthlyNeeded)}</td></tr></tfoot>` : ''}</table></div>
    <p class="tiny" style="margin-top:8px">Estimates use the price-rise and return assumptions shown under each goal. They are for planning only; actual returns will differ.</p>
    ${P.equity != null ? `<div class="card pad" style="margin-top:14px"><div class="row" style="justify-content:space-between"><b>Overall mix</b><span class="small muted">About ${P.equity}% equity · ${100 - P.equity}% debt</span></div><div class="mixbar" style="margin-top:10px;height:14px"><i style="width:${P.equity}%;background:var(--eq)"></i><i style="width:${100 - P.equity}%;background:var(--debt)"></i></div><p class="tiny" style="margin-top:8px">Weighted by the monthly amount each goal needs. Hybrid funds are counted by their usual equity share.</p></div>` : ''}

    <h2 class="goalsec">Goal by goal</h2>
    ${P.goals.map((g) => { const c = cat(g.suggestion.primary), s = g.suggestion;
      const notes = [...s.teach.map((k) => `<div class="note">${esc(X(k))}</div>`), ...s.warnings.filter((k) => k !== 'w_no_emergency').map((k) => `<div class="note warn">${esc(X(k))}</div>`), ...s.notes.filter((k) => !['n_min_sip', 'n_stp'].includes(k)).map((k) => `<div class="note">${esc(X(k))}</div>`)].join('');
      const sizing = g.goal.type === 'emergency' ? `Target ${short(g.target)} (${g.goal.months || 6} months of expenses)${g.gap ? `; ${short(g.gap)} still to set aside` : '; fully covered'}.`
        : g.futureCost ? `${g.goal.type === 'retirement' ? `A corpus of about ${RETIREMENT_MULTIPLE} years of today's expenses` : 'Costs ' + short(g.goal.cost) + ' today'}; about <b>${short(g.futureCost)}</b> by ${esc(g.goal.year)} at ${esc(g.inflation)}% price rise a year.${g.goal.saved ? ` Your ${short(g.goal.saved)} already saved counts towards it (assumed to grow at 7% a year).` : ''} ${g.sip ? `Needs an estimated <b>${rupees(g.sip)} a month</b>, or ${short(g.lumpsum)} invested once today, assuming ${esc(g.rate)}% a year${g.safeRate ? `, and ${g.safeRate}% in the last 2 years after moving to safer funds` : ''}.` : 'What you have saved already covers it at these assumptions.'}`
        : g.goal.type === 'wealth' ? `${g.goal.sipNow ? `You plan to invest ${rupees(g.goal.sipNow)} a month` : 'No fixed amount'} for about ${Math.round(g.years)} years.`
        : g.goal.regime === 'new' ? 'No tax deduction under the new regime; this goal is treated as regular investing.' : 'Up to ₹1.5 lakh a year counts for the tax-saving deduction under the old regime (Section 123, formerly 80C).';
      return `<details class="card gcard g-${c.group}" open><summary><span class="h3" role="heading" aria-level="3">${esc(g.goal.label || g.type.n)} <span class="tiny" style="font-weight:600">${esc(whenTxt(g))} · ${esc(c.name)}</span></span></summary>
        <div class="row" style="justify-content:space-between;margin-top:8px;align-items:flex-start"><div><div class="tiny" style="font-weight:800">Fund category that generally fits</div><div class="fund">${esc(c.name)}</div><div class="small muted">${esc(c.what)}</div></div><div style="min-width:130px">${risk6(c.risk)}<div class="tiny" style="margin-top:4px">${esc(c.risk)} risk</div></div></div>
        <p class="small" style="margin-top:12px">${sizing}</p>
        <ul class="small">${s.reasons.map((k) => `<li>${esc(X(k))}</li>`).join('')}</ul>${notes}
        ${s.alts.length ? `<div class="alts-wrap no-print"><div class="tiny" style="font-weight:800;margin-top:12px">Also suits this goal</div><div class="alts">${s.alts.map((id) => `<button class="altchip" type="button" data-fund="${id}" title="${esc(ALT_WHY[id] || '')}">${esc(cat(id).name)}</button>`).join('')}<button class="altchip" type="button" data-fund="${c.id}">See ${esc(c.name.replace(/ Fund$/, ''))} funds</button></div></div><p class="print-only tiny" style="margin-top:6px">Also suits this goal: ${s.alts.map((id) => esc(cat(id).name)).join(', ')}.</p>` : ''}</details>`; }).join('')}

    <div class="cta-box">
      <h2>Next: let's pick the schemes</h2>
      <p>Send me this summary. I'll suggest schemes I distribute for each goal, explain why, and tell you what I earn on each before you decide.</p>
      <div class="no-print" style="margin-top:16px">${contactButtons(msg, `Goal summary${st.name ? ' – ' + st.name : ''}`, { light: true, waLabel: 'Send my summary on WhatsApp' })}</div>
      <div class="row no-print" style="margin-top:12px"><button class="btn ghost" type="button" id="printBtn">${ICON.print}Save as PDF</button><button class="btn ghost" type="button" id="copyBtn">${ICON.link}Copy link</button>${isShared ? '' : '<a class="btn ghost" href="#planner" id="editBtn">Edit answers</a>'}</div>
      <p class="tiny no-print" style="margin-top:10px;color:inherit;opacity:.75">Anyone with the link can see these details. Share it only with me.</p>
      ${isPH(CONFIG.phone) && isPH(CONFIG.email) ? '' : `<p class="print-only" style="margin-top:10px">Contact: ${[CONFIG.phone, CONFIG.email].filter((x) => !isPH(x)).map(esc).join(' · ')}</p>`}
    </div>

    <div class="keep"><h2>What to have ready</h2>
    <ul class="checklist"><li>PAN card</li><li>Aadhaar, with your mobile number linked (for the OTP)</li><li>A recent photo</li><li>Your email address</li><li>Bank account proof (cancelled cheque or statement)</li><li>Nominee details (you can name up to 10)</li></ul></div>

    <div class="keep"><h2>About this summary</h2>
    <p class="small muted">This summary uses your answers to show the fund category that generally fits each goal and to estimate the money each goal needs. It is not a recommendation of any scheme, not financial planning and not investment advice. Amounts use the price-rise and return assumptions shown, which are for planning only; actual returns will differ and can be negative. Scheme suitability is confirmed only after we discuss your full situation. ${esc(CONFIG.notAdviser)} Mutual Fund investments are subject to market risks, read all scheme related documents carefully.</p></div>
  </div></div>`;
  $('#printBtn').onclick = () => { $$('details.gcard', el).forEach((d) => d.open = true); window.print(); };
  if (matchMedia('(max-width: 640px)').matches) $$('details.gcard', el).forEach((d, i) => { if (i > 0) d.open = false; });
  $('#copyBtn').onclick = () => { navigator.clipboard?.writeText(link).then(() => toast('Link copied'), () => prompt('Copy this link:', link)); };
  $('#adopt')?.addEventListener('click', () => { STATE = sanitizeState(shared) || STATE; save(); location.hash = 'plan'; toast('Saved on this device'); });
  $('#editBtn')?.addEventListener('click', () => { STEP = 2; });
  $$('[data-fund]', el).forEach((b) => b.onclick = () => openFund(b.dataset.fund));
}

/* ================= FUND TYPES ================= */
let FFILTER = 'all', FQ = '';
function funds(arg) {
  const el = $('#v-funds');
  const groups = CATS.groups.filter((g) => g.id !== 'solution');
  el.innerHTML = `<div class="wrap" style="padding:40px 20px 60px">
    <div class="head"><div class="eyebrow">Reference</div><h1 style="font-size:clamp(2rem,4.5vw,2.8rem);margin:10px 0 12px">All ${ACTIVE().length} fund categories</h1><p>SEBI defines every category of mutual fund, so a name means the same thing at every fund house. Open one to see what it's for and which funds belong to it.</p></div>
    <div class="filters" role="group" aria-label="Filter">${[['all', 'All'], ...groups.map((g) => [g.id, g.name])].map(([id, n]) => `<button class="chip g-${id}" type="button" data-f="${id}" aria-pressed="${FFILTER === id}">${id !== 'all' ? '<i></i>' : ''}${esc(n)}</button>`).join('')}</div>
    <label class="sr" for="fq">Search fund types</label><input class="search" id="fq" type="search" placeholder="Search, e.g. liquid, gold, tax" value="${esc(FQ)}">
    <div id="ftbody"></div>
    <p class="small muted" style="margin-top:30px">Retirement Funds and Children's Funds stopped accepting new money in February 2026. Existing investments continue until SEBI approves their merger into similar funds.</p></div>`;
  const draw = () => {
    const q = FQ.toLowerCase().trim(); const out = [];
    for (const g of groups) {
      if (FFILTER !== 'all' && FFILTER !== g.id) continue;
      const cs = ACTIVE().filter((c) => c.group === g.id && (!q || `${c.name} ${c.was || ''} ${c.what}`.toLowerCase().includes(q)));
      if (!cs.length) continue;
      out.push(`<div class="grouphead g-${g.id}"><h3>${esc(g.name)}</h3><span class="dim small">${cs.length} type${cs.length > 1 ? 's' : ''}</span><span class="d">${esc(g.about)}</span></div><div class="ftlist">${cs.map((c) => `<button class="ft g-${c.group}" type="button" data-fund="${c.id}"><span class="bar"></span><span><b>${esc(c.name)}${c.status === 'new' ? ' <span class="tiny" style="color:var(--brass);font-weight:800">New</span>' : ''}</b><small>${esc(c.stat[0])} ${esc(c.stat[1])}</small></span><span class="c3 small muted">${esc(c.horizon)}</span><span class="c4">${riskIndex(c.risk) >= 0 ? risk6(c.risk) : ''}</span><span class="c5 small muted">${esc(c.risk)}</span>${ICON.chev}</button>`).join('')}</div>`);
    }
    $('#ftbody').innerHTML = out.join('') || `<div class="empty" style="margin-top:16px">Nothing matches "${esc(q)}". Try a shorter word.</div>`;
  };
  draw();
  el.querySelector('.filters').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; FFILTER = b.dataset.f; funds(); };
  $('#fq').oninput = (e) => { FQ = e.target.value; draw(); };
  el.onclick = (e) => { const b = e.target.closest('[data-fund]'); if (b) openFund(b.dataset.fund); };
  if (arg) openFund(arg);
}

/* ---- drawer: one fund type + its funds (Regular plans) ---- */
let drawerReturn = null;
function closeDrawer() {
  if (!$('#drawer').classList.contains('on')) return;
  $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); document.body.style.overflow = '';
  if (drawerReturn && document.contains(drawerReturn)) drawerReturn.focus(); drawerReturn = null;
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !$('#drawer').classList.contains('on')) return;
  const f = $$('#drawer a[href], #drawer button:not([disabled]), #drawer input, #drawer select').filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});
$('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
const KIND = { equity: 'Share indices', debt: 'Bond indices', gold: 'Gold', silver: 'Silver', intl: 'International', hybrid: 'Hybrid' };
async function openFund(id) {
  const c = cat(id); if (!c) return;
  const d = $('#drawer');
  drawerReturn = document.activeElement;
  const discuss = contact.wa(`Hi, I'd like to discuss ${c.name} options for my goals.`);
  d.innerHTML = `<div class="dh"><div><div class="tiny" style="font-weight:800;color:${GCOL[c.group]}">${esc(grp(c.group).name)}</div><h2 id="drawerTitle" style="font-size:1.6rem">${esc(c.name)}</h2>${c.was ? `<div class="tiny">Earlier called ${esc(c.was)}</div>` : ''}</div><button class="x" type="button" aria-label="Close">×</button></div>
    <div class="db"><p style="font-size:1.08rem;margin-top:0">${esc(c.what)}</p>
      <div class="facts"><div><small>Key rule</small><b>${esc(c.stat[0])}</b><div class="tiny">${esc(c.stat[1])}</div></div><div><small>Time horizon</small><b>${esc(c.horizon)}</b></div><div><small>Typical risk</small><b>${esc(c.risk)}</b></div></div>
      <p class="small muted"><b>SEBI's rule:</b> ${esc(c.rule)}</p>
      <div id="fundTable" style="margin-top:22px"><p class="dim small">Loading funds…</p></div>
      <div class="card pad" style="margin-top:22px"><b>Not sure which one suits you?</b><p class="small muted">I'll look at your goals and each fund's consistency, costs and risk, and tell you what I earn on each.</p>${discuss ? `<a class="btn sm" href="${esc(discuss)}" target="_blank" rel="noopener">${ICON.chat}Discuss with me</a>` : '<a class="btn sm" href="#contact">Discuss with me</a>'}</div>
    </div>`;
  d.classList.add('on'); $('#scrim').classList.add('on'); document.body.style.overflow = 'hidden';
  d.scrollTop = 0; $('.x', d).onclick = closeDrawer; $('.x', d).focus();
  await ensureSchemes();
  const box = $('#fundTable');
  if (!box) return;
  if (!SCHEMES) { box.innerHTML = '<p class="dim small">Fund data isn\'t available right now.</p>'; return; }
  const all = BY_CAT[id] || [];
  if (!all.length) { box.innerHTML = `<div class="empty small">No fund house offers a scheme of this type yet.</div>`; return; }
  const kinds = [...new Set(all.map((s) => s.k).filter(Boolean))];
  const st = { q: '', kind: kinds.includes('equity') ? 'equity' : kinds[0] || '', all: false };
  box.innerHTML = `<h3>${esc(c.name.replace(/ Fund$/, ''))} funds available in India</h3>
    <p class="small muted" style="margin-top:4px">${all.length} funds from ${new Set(all.map((s) => s.a)).size} fund houses, listed A to Z, from AMFI's daily list. This is a list, not a ranking or a recommendation.</p>
    ${kinds.length > 1 ? `<div class="filters" style="margin:10px 0 0">${kinds.map((k) => `<button class="chip" type="button" data-kind="${k}" aria-pressed="${st.kind === k}">${esc(KIND[k] || k)}</button>`).join('')}</div>` : ''}
    <div class="cmp-tools"><label class="sr" for="cq">Search</label><input class="search" id="cq" type="search" placeholder="Search by fund or fund house" style="max-width:280px"></div>
    <table class="cmp"><thead><tr><th>Fund</th><th>Fund house</th><th>Running for</th></tr></thead><tbody></tbody></table>
    <button class="link small" type="button" id="cmore" style="margin-top:10px" hidden></button>
    <p class="small" style="margin-top:14px">To see each fund's returns against its benchmark, use <a href="https://www.amfiindia.com/otherdata/fund-performance" target="_blank" rel="noopener">AMFI's fund performance page</a>. When we speak, I'll compare the funds that fit your goal on consistency, cost and risk, from the fund houses I distribute.</p>`;
  const tb = $('tbody', box);
  const age = (s) => (s.y >= 5 ? '5+ years' : s.y >= 3 ? '3–5 years' : s.y >= 1 ? '1–3 years' : 'Under 1 year');
  const draw = () => {
    const rows = all.filter((s) => (!st.kind || !s.k || s.k === st.kind) && (!st.q || (SCHEMES.amcs[s.a].name + ' ' + s.n).toLowerCase().includes(st.q))).sort((a, b) => a.n.localeCompare(b.n));
    const shown = st.all || st.q ? rows : rows.slice(0, 15);
    tb.innerHTML = shown.map((s) => `<tr><td class="fn">${esc(s.n)}</td><td data-l="Fund house">${esc(SCHEMES.amcs[s.a].name.replace(/\s+Mutual Fund$/i, ''))}</td><td data-l="Running for">${age(s)}</td></tr>`).join('') || '<tr><td colspan="3" class="dim">No fund matches.</td></tr>';
    const more = $('#cmore'); more.hidden = st.all || !!st.q || rows.length <= 15; more.textContent = `Show all ${rows.length}`;
  };
  draw();
  $('#cq').oninput = (e) => { st.q = e.target.value.toLowerCase().trim(); draw(); };
  $('#cmore').onclick = () => { st.all = true; draw(); };
  $$('[data-kind]', box).forEach((b) => b.onclick = () => { st.kind = b.dataset.kind; $$('[data-kind]', box).forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); });
}

/* ================= SERVICES ================= */
function services() {
  $('#v-services').innerHTML = `<div class="wrap" style="padding:40px 20px 60px">
    <div class="head"><div class="eyebrow">For investors</div><h1 style="font-size:clamp(2rem,4.5vw,2.8rem);margin:10px 0 12px">Help with your investments</h1><p>Whether you're starting out or already invest with me, here's how everyday tasks work. For any of these, just message me.</p></div>
    <div class="svc">
      <div class="card"><h3>Starting out: KYC</h3><p class="small muted">A one-time check that works for every fund house. Done online in minutes.</p><ul class="small" style="padding-left:1.1em"><li>PAN and Aadhaar (mobile linked for the OTP)</li><li>A photo and your email</li><li>Bank proof, needed when you first invest</li></ul><p class="tiny">If your KYC status shows "registered" rather than "validated", it may need a quick re-verification.</p></div>
      <div class="card"><h3>Nominees</h3><p class="small muted">Add nominees to every folio so your family can claim easily. You can name up to 10, with the share each should get.</p></div>
      <div class="card"><h3>Statements</h3><p class="small muted">Your Consolidated Account Statement (CAS) shows all your funds in one place. It's emailed in any month you transact, and every six months otherwise. You can also download it anytime from <a href="https://www.mfcentral.com" target="_blank" rel="noopener">MF Central</a>.</p></div>
      <div class="card"><h3>Changing a SIP</h3><p class="small muted">Increase, pause or stop a SIP whenever you need. Tell me and I'll arrange it, or do it yourself on MF Central.</p></div>
      <div class="card"><h3>Withdrawing money</h3><p class="small muted">Redeem any working day. Money usually reaches your bank within 1–3 working days (liquid funds by the next day). Check the exit load period first.</p></div>
      <div class="card"><h3>Updating details</h3><p class="small muted">Change of bank, address, mobile, email or nominee can be done across all fund houses at once through MF Central, or with my help.</p></div>
    </div>
    <div class="card pad" style="margin-top:22px"><h2 style="font-size:1.4rem">If something goes wrong</h2><p class="muted">I'll always try to sort things out first. If you're not satisfied, you have every right to escalate:</p>
      <ol class="escalate">
        <li><div><b>Contact me</b> by WhatsApp, phone or email. I'll respond within ${esc(CONFIG.responseDays || 2)} working days.</div></li>
        <li><div><b>Contact the fund house</b> through its investor service email or helpline (listed on its website and your statement). Complaints about a fund or a transaction should go to the fund house first.</div></li>
        <li><div><b>SEBI SCORES:</b> lodge a complaint on SEBI's complaints portal, <a href="https://scores.sebi.gov.in" target="_blank" rel="noopener">scores.sebi.gov.in</a>.</div></li>
        <li><div><b>SMART ODR:</b> if you're still not satisfied, use the online dispute resolution portal, <a href="https://smartodr.in" target="_blank" rel="noopener">smartodr.in</a>.</div></li>
      </ol><p class="small muted" style="margin-top:12px">You can also report a distributor's conduct to AMFI, the body that registers mutual fund distributors, through <a href="https://www.amfiindia.com" target="_blank" rel="noopener">amfiindia.com</a>.</p></div>
  </div>`;
}

/* ================= ABOUT & DISCLOSURES ================= */
function about() {
  $('#v-about').innerHTML = `<div class="wrap narrow" style="padding:40px 20px 60px">
    <div class="eyebrow">About &amp; disclosures</div>
    <div class="row" style="margin:14px 0 8px;gap:18px"><span class="mono" style="width:64px;height:64px;font-size:1.4rem;border-radius:16px">${esc(CONFIG.initials)}</span><div><h1 style="font-size:clamp(1.9rem,4vw,2.5rem)">${esc(CONFIG.name)}</h1><div class="muted">Mutual Fund Distributor · ${esc(CONFIG.city)}</div></div></div>
    <p style="font-size:1.1rem">${esc(CONFIG.bio)}</p>
    <ul style="padding-left:1.1em">${CONFIG.credentials.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <h2 style="font-size:1.4rem;margin-top:30px">Registration</h2>
    <div class="idcard" style="margin-top:12px"><div><small>Registered as</small><b>AMFI-registered Mutual Fund Distributor</b></div><div><small>ARN</small><b>${esc(CONFIG.arn)}</b></div><div><small>ARN valid till</small><b>${esc(CONFIG.arnValidTill)}</b></div><div><small>EUIN</small><b>${esc(CONFIG.euin)}</b></div></div>
    <p class="small muted" style="margin-top:10px">You can verify my registration on <a href="https://www.amfiindia.com/locate-distributor" target="_blank" rel="noopener">AMFI's distributor search</a>.</p>
    <h2 style="font-size:1.4rem;margin-top:30px">How I'm paid</h2>
    <p>I'm paid a trail commission by fund houses on the Regular plans you invest in through me. It comes out of the scheme's yearly expense ratio, not as a separate fee from you. Commission rates differ between schemes and fund houses. Before you invest, I'll tell you the commission I earn on each scheme I suggest, and on the alternatives we considered.</p>
    <p>Every fund also has a Direct plan with a lower expense ratio, which you can buy straight from the fund house without a distributor.</p>
    <h2 style="font-size:1.4rem;margin-top:30px">My commitments to you</h2>
    <ul>
      <li>I'll put your interest first and suggest only schemes that suit your goals, timeline and risk profile.</li>
      <li>I'll never promise or suggest guaranteed or indicative returns.</li>
      <li>I won't encourage unnecessary switching between schemes.</li>
      <li>I'll give you the scheme documents (SID, KIM) and explain the risks before you invest.</li>
      <li>I'll keep your personal information confidential.</li>
      <li>Your money always goes directly from your bank to the fund house. I never accept cash or payments in my name for investments.</li>
    </ul>
    <h2 style="font-size:1.4rem;margin-top:30px">Important information</h2>
    <p class="small muted">${esc(CONFIG.notAdviser)} The goal summary on this site shows the fund category that generally fits each goal based on your answers. It is not financial planning, not investment advice under the SEBI (Investment Advisers) Regulations, 2013, and not a recommendation to buy any scheme. Planning figures use assumptions you can see and change; actual returns will differ. Scheme lists are taken from AMFI's public data and updated daily; this site does not show or rank scheme returns. Fund categories follow SEBI's circular on categorisation of mutual fund schemes dated 26 February 2026. Mutual Fund investments are subject to market risks, read all scheme related documents carefully.</p>
    <h2 style="font-size:1.4rem;margin-top:30px">Your privacy</h2>
    <p class="small muted">This site has no sign-up, no cookies and no analytics. Your answers are saved only in your own browser so you can come back to them, and nothing is stored on a server. If you share your summary, the link carries your answers inside it, so anyone with the link can see them, and the app you send it through (WhatsApp or email) will hold a copy. Share it only with me. You can clear your saved answers below.</p>
    <p><button class="link small" type="button" id="clearAll">Clear my saved answers from this device</button></p>
  </div>`;
  $('#clearAll').onclick = () => { if (confirm('Clear your saved answers and goals from this device?')) { try { localStorage.removeItem(KEY); } catch {} STATE = { name: '', profile: {}, goals: [] }; toast('Cleared'); } };
}

/* ================= CONTACT ================= */
function contactView() {
  const prof = scoreProfile(STATE.profile);
  const hasPlan = prof.complete && STATE.goals.length && !STATE.goals.some(goalProblem);
  const text = hasPlan ? summaryText(STATE, planAll(STATE, NOWF), (id) => cat(id).name, planLink()) : `Hi ${CONFIG.name.split(' ')[0]}, I'd like to talk about investing in mutual funds.`;
  $('#v-contact').innerHTML = `<div class="wrap narrow" style="padding:40px 20px 60px">
    <div class="eyebrow">Talk to me</div><h1 style="font-size:clamp(2rem,4.5vw,2.8rem);margin:10px 0 12px">Let's talk about your money</h1>
    <p class="muted" style="font-size:1.1rem">${hasPlan ? 'Your goal summary is ready. Send it with one tap and I\'ll review it before we speak.' : 'Message, call or book a time. If you have 10 minutes first, setting out your goals makes our conversation far more useful.'}</p>
    <div class="card pad" style="margin-top:18px">${contactButtons(text, hasPlan ? 'My goal summary' : 'Mutual fund enquiry', { waLabel: hasPlan ? 'Send my summary on WhatsApp' : 'WhatsApp me' })}
      ${!hasPlan ? '<p style="margin:16px 0 0"><a href="#planner" style="font-weight:700">Set out my goals first (10 minutes)</a></p>' : ''}</div>
    <div class="idcard" style="margin-top:22px"><div><small>Phone</small><b>${isPH(CONFIG.phone) ? esc(CONFIG.phone) : '+' + digits(CONFIG.phone)}</b></div><div><small>Email</small><b style="word-break:break-all">${esc(CONFIG.email)}</b></div><div><small>City</small><b>${esc(CONFIG.city)}</b></div><div><small>ARN · EUIN</small><b>${esc(CONFIG.arn)} · ${esc(CONFIG.euin)}</b></div></div>
    <p class="tiny" style="margin-top:14px">I never ask for your bank passwords or OTPs, and I never accept investment money in my name. Payments always go directly to the fund house.</p>
  </div>`;
}

/* ================= boot ================= */
(async function boot() {
  paintChrome();
  try { CATS = await loadJson('data/categories.json'); }
  catch { $('#main').innerHTML = '<div class="wrap" style="padding:40px 20px"><div class="empty"><b>This page couldn\'t load its data.</b><p>Open it from its web address; browsers block data files when a page is opened from your computer.</p></div></div>'; return; }
  route();
  setTimeout(ensureSchemes, 1200);
})();

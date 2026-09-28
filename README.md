# Mutual fund distributor client site (FundFit v3)

A professional website for an AMFI-registered Mutual Fund Distributor to send to prospects who ask "where should I invest?". Before the first conversation, they:

1. **Learn** the basics in a 10-minute plain-language guide.
2. **Set out their goals and risk profile.** Nine questions give a profile scored on ability and willingness to take risk; the profile is whichever of the two is more careful. Then they add goals: emergency fund, education, house, car, wedding, retirement, wealth or tax.
3. **Get a written goal and risk profile summary.** It shows the fund category that generally fits each goal, an inflation-adjusted amount for each goal, and an estimated monthly SIP. They can save it as a PDF, share it as a link, or send it to you on WhatsApp or email in one tap.

The site also has:

- a reference page for all 40 SEBI fund categories, each listing the funds of that category from AMFI's daily file;
- an "For investors" page covering KYC, nominees, statements, SIP changes, redemptions and complaints;
- a full "About & disclosures" page.

There's no backend, sign-up, cookies or analytics. Answers stay in the visitor's browser. A shared summary carries its data inside the link itself, so nothing is stored on a server.

## Before you share it: edit `js/config.js`

This is the only file you need to change. Every value still in `[square brackets]` shows a **Preview** banner across the site, so it can't go out with missing registration or contact details.

| Field | What to put |
|---|---|
| `arn`, `arnValidTill`, `euin` | Your AMFI registration. Shown in the header, footer, About page, the plan summary and every printed page. |
| `whatsapp`, `phone` | Country code plus number, digits only, e.g. `919876543210`. |
| `email`, `booking` | Your enquiry email address and booking link (Calendly, Google Calendar booking page or similar). |
| `bio`, `credentials` | What clients read about you. |
| `responseDays` | Your complaint response time in working days, shown in the complaints section. |
| `notAdviser` | Keep this true to your registrations. Change it if you become a SEBI-registered Investment Adviser; see the note below. |

## Publish on GitHub Pages

1. Put this folder in a new public repo.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Settings → Actions → General → Workflow permissions: Read and write.**
4. **Actions → "Refresh AMFI/SEBI data and deploy" → Run workflow.**

The workflow runs every morning. It tests the code, refreshes the AMFI scheme list and SEBI circulars, and redeploys the site.

## How the suggestions work (`js/engine.js`)

- **Profile.** The five "ability" answers (age, dependants, income, emergency cushion, EMIs) and the four "willingness" answers (reaction to a fall, choice of outcomes, experience, objective) are each scored 1 to 5. The profile is the lower of the two. Anyone who says they'd *sell* after a 20% fall is capped at "Moderately conservative".
- **Fund category per goal.** The goal's time horizon and purpose pick candidate categories, using the same tested rules as FundFit v2. The profile then limits what can be shown:
  - Levels 1–2: nothing above Moderately High risk.
  - Level 3: Very High only through hybrid, large cap and index funds.
  - Level 4: adds diversified equity.
  - Level 5: everything.
  - Must-have goals within 5 years get Moderate risk or lower, whatever the profile.
- **Sizing.**
  - Goal costs are inflated at the goal's own rate (education 10%, house 7%, others 6%).
  - SIPs assume the category's planning return until the last 2 years, then 7% after moving to safer funds.
  - Existing savings grow at 7%.
  - Retirement is sized at 30 years of today's expenses.

  Every assumption is shown in the summary and can be changed per goal.

`node --test tests/*.test.mjs` runs 30 tests, including:

- every profile level against every goal type and horizon;
- the risk caps;
- the SIP maths;
- sanitising of shared links (an XSS payload test);
- consistency between each explanation and the fund actually shown.

## Compliance choices built in

- ARN, ARN validity and EUIN appear on every page, including every printed page, as AMFI's code of conduct requires.
- The standard risk warning appears word for word in the footer and on every printed page.
- Commission is disclosed in several places: the home page, the FAQ, the About page and the summary itself.
- The summary is framed as distribution support, not financial planning or investment advice under the SEBI (Investment Advisers) Regulations, 2013. This is stated at the top of the summary and in the FAQ.
- The site shows fund categories, not specific scheme recommendations.
- No scheme returns are shown or ranked. Scheme lists are A to Z, and users are pointed to AMFI's fund performance page for returns against benchmarks.
- There are no guarantees, and no safety-implying words ("safe", "protected", "guaranteed", "no risk").
- Complaints escalate in order: you, then the fund house, then SEBI SCORES, then SMART ODR. AMFI is listed for complaints about a distributor.
- Tax wording follows the Income-tax Act, 2025 from 1 April 2026: Section 123, formerly 80C.

**If your SEBI RIA registration comes through:** SEBI requires an individual investment adviser to keep advisory and distribution activities separate. Review this site's distributor branding with your compliance advisor before using it alongside an advisory practice.

## Files

```
index.html          page shell and all styles (light, dark and print)
js/config.js        your details: the only file you edit
js/engine.js        profile scoring, goal maths, fund-category rules (pure functions, tested)
js/app.js           all pages
data/categories.json  the 40 SEBI fund categories, in plain language
data/schemes.json   AMFI scheme list (refreshed daily)
data/sebi.json      SEBI mutual fund circulars (refreshed daily)
scripts/            daily data refresh (Node, no dependencies)
fonts/              Plus Jakarta Sans, self-hosted (SIL Open Font License)
og.png              link preview image for WhatsApp and social sharing
```

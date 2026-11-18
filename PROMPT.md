# Numora — Master Build Prompt for Claude

> Paste everything below the line into Claude Code, opened in this repository. Run it **one phase at a time** and review each phase on the GitHub Pages preview before moving on.

---

## 0. Your role and how to work

You are a senior full-stack engineer, product designer and technical SEO lead. You are building **Numora** (working name), a global website of money calculators that act as *decision engines*: they don't just compute a number, they explain what it means for this person, in their country and city, and what to change.

Working rules:
- Work in the phases in section 12. At the start of each phase, show the plan and file tree, then build, then stop and summarize what to test.
- Never invent tax rates, limits or rules. Every value in a country rule file needs an official source URL and a "valid from" date. If you can't verify a value, leave it out and list it as an open question.
- Prefer simple, readable code over clever code. Every formula has unit tests.
- When in doubt about UX, choose the option that gets a first-time visitor to a correct answer fastest.

## 1. Hard constraints

1. **100% static site.** No backend, no database, no server functions.
2. **No AI or LLM APIs, and no paid third-party APIs.** All "smart" behaviour is deterministic code running in the browser.
3. **All calculations run client-side** from one shared TypeScript engine of pure functions.
4. **No personal data leaves the browser.** No accounts. Saving uses localStorage; sharing uses URL-encoded inputs.
5. **Preview first, launch later.** The site is hosted on GitHub Pages at `https://harshadprabhu.github.io/Numora/` for review. While in preview it must not be indexed (see section 10).

## 2. Stack

- **Astro** + TypeScript + Tailwind CSS. Static output only.
- Islands for interactive calculators (Preact or vanilla TS, whichever is lighter). Total JS per page under 100 KB gzipped.
- **Vitest** for unit tests. **Playwright** for a smoke test of each calculator.
- Charts: hand-written SVG components (no heavy chart library).
- Deployment: GitHub Actions → GitHub Pages. Astro `site` and `base` configured for `/numora/` during preview; switching to a custom domain later must be a one-line config change.
- Country data: versioned JSON in `/data/rules/{country}.json`, validated against a JSON schema at build time. A build fails if any value lacks `source` and `validFrom`.

Suggested structure:
```
/src/engine/         pure calculation functions + insight engine + parser (no DOM)
/src/engine/locales/ country rule adapters (mortgage conventions, tax, loan types)
/src/components/     UI components (design system)
/src/islands/        interactive calculators
/src/pages/[locale]/ localized pages
/src/i18n/           UI strings + insight templates per locale
/data/rules/         country JSON with sources
/data/cities/        city JSON with sources
/tests/              Vitest + Playwright
```

## 3. Markets, locales and cities

**Countries** (top 10 economies by nominal GDP, plus Australia): United States, China, Germany, India, Japan, United Kingdom, France, Italy, Brazil, Canada, Australia.

**Locales and URLs** (subfolders, all with hreflang + x-default):
`/en-us/ /en-gb/ /en-ca/ /fr-ca/ /en-au/ /en-in/ /de-de/ /ja-jp/ /fr-fr/ /it-it/ /pt-br/ /zh-cn/` (Hindi `/hi-in/` later).

**Auto-detection:** on the root page, suggest (never force) a locale from `navigator.language` and the timezone, with a visible country switcher in the header. Remember the choice in localStorage.

**Formatting:** always via the `Intl` API — currency, numbers (including Indian lakh/crore grouping in en-IN), percentages, dates. Never hand-format numbers.

**Localize the math, not just the words.** Required conventions:
| Country | Rules the engine must handle |
| --- | --- |
| US | Property tax, PMI, federal + state income tax, FICA, 401(k)/IRA limits |
| UK | Stamp Duty Land Tax (England/NI), LBTT (Scotland), LTT (Wales), PAYE bands, National Insurance, ISA allowance |
| Canada | Fixed mortgages compound semi-annually; CMHC insurance; provincial tax; land transfer tax (Toronto has an extra municipal tax) |
| Australia | Stamp duty by state, lenders mortgage insurance, superannuation guarantee |
| India | Reducing-balance EMI, old vs new tax regime, stamp duty by state, SIP/step-up SIP, GST |
| Germany | Annuity loans defined by Tilgung (initial repayment rate), Zinsbindung (fixed period), Grunderwerbsteuer by state, payroll incl. church tax and solidarity surcharge |
| Japan | Bonus-month repayments, Flat 35, equal-payment vs equal-principal, resident + income tax |
| France | Loan insurance (assurance emprunteur), 35% debt-to-income cap, notary fees, income tax by household shares (quotient familial) |
| Italy | TAEG, IRPEF bands, notary and registration taxes |
| Brazil | SAC vs Price (Tabela Price) amortization, Selic-linked rates, IR tables |
| China | Equal-principal vs equal-installment, housing provident fund (公积金) loans and combined loans, IIT |

**Cities.** For each country, cover its top economic cities: New York, Los Angeles, Chicago, San Francisco, Houston · London, Manchester, Edinburgh · Toronto, Vancouver, Montréal · Sydney, Melbourne, Brisbane · Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune · Berlin, Munich, Frankfurt, Hamburg · Tokyo, Osaka, Nagoya · Paris, Lyon, Marseille · Milan, Rome, Turin · São Paulo, Rio de Janeiro, Brasília · Shanghai, Beijing, Shenzhen, Guangzhou.

City-page rule (critical for SEO): **create a city page only when its inputs genuinely differ** — local transfer/stamp duty, property tax, city/state income tax, typical home prices and rents, cost of living. Each city page shows its local data with sources, a worked example in local currency, and a comparison with the national average. If a city has no unique data, don't create a page; link to the country page. Never generate near-duplicate pages.

## 4. Features — what we are building and how each works

### 4.1 Calculators (launch set)

Every calculator has: **inputs panel**, **live result**, **insights**, **what-if sliders**, **chart**, **schedule table**, **save / share / print**, **methodology**, **FAQ**, **partner slot**.

| # | Calculator | Key inputs | Key outputs |
| --- | --- | --- | --- |
| 1 | Mortgage payoff & extra payments | Balance, rate, remaining term, monthly extra, one-off lump sums, country loan type | New payoff date, interest saved, time saved, amortization schedule |
| 2 | Debt payoff: snowball vs avalanche | List of debts (name, balance, APR, minimum), monthly budget | Debt-free date per method, total interest per method, payoff order, month-by-month plan |
| 3 | Take-home pay | Gross salary, pay frequency, region/state, deductions, tax regime (India) | Net pay per period, tax breakdown, effective and marginal rate |
| 4 | Rent vs buy | Home price, deposit, rate, rent, rent growth, price growth, horizon, local taxes/fees | Break-even year, net-worth comparison over time |
| 5 | Refinance break-even | Current loan, new rate, fees, term | Break-even month, lifetime saving |
| 6 | Retirement / FIRE | Age, savings, contribution, expected return range, inflation, target spending | FIRE number, projected age, range of outcomes (pessimistic / expected / optimistic) |
| 7 | Savings goal & compound interest | Start amount, monthly add, rate, years or target | Final value or required monthly saving, growth chart |
| 8 | Credit card payoff & balance transfer | Balance, APR, payment, transfer fee, promo period | Payoff time, interest, transfer saving |
| 9 | Car loan, lease vs buy | Price, deposit, rate, term, residual, lease payment | Total cost each way, monthly difference |
| 10 | Freelancer / self-employed tax | Income, expenses, country rules | Tax owed, quarterly set-aside |
| 11 | Salary & cost-of-living between cities | Salary, from city, to city | Equivalent salary, category differences |
| 12 | India: EMI, SIP, old vs new regime | Country-specific inputs | Country-specific outputs |

### 4.2 Calculation engine (`/src/engine`)
- Pure functions, no DOM, no dates from the system clock inside formulas (pass dates in).
- Money in minor units (integers) or decimal library to avoid floating-point drift; round only for display.
- Each calculator exports `calculate(inputs, rules) → result` and `validate(inputs) → errors`.
- Country adapters supply conventions (compounding frequency, amortization type, tax tables).

### 4.3 Insight engine ("Explain my result") — no AI
How it works:
1. Take the visitor's inputs and result.
2. Generate candidate levers per calculator (e.g. +50/+100/+200 monthly, −0.5%/−1% rate, shorter term, one lump sum, switch snowball→avalanche).
3. Re-run the engine for each lever; measure impact (months saved, interest saved, net-worth change).
4. Rank by impact per unit of effort; keep the top 3.
5. Render each with a per-locale template using ICU MessageFormat, e.g. `"Paying {extra, number, ::currency} more each month clears your mortgage {years} years sooner and saves {saved, number, ::currency} in interest."`
6. Add one "watch out" insight from rules (e.g. "Your payment is below the interest charged — the balance is growing").
Rules: insights never name a product, never say "you should invest in", and always sit above the disclaimer. Every template has tests, including edge cases (zero balance, 0% rate, 40-year term, payment too small).

### 4.4 Plain-language input — no AI
A text box: "Describe your situation". Example: `I owe $18k on 3 cards at 24%, can pay 900 a month`.
- Parse with regex + per-locale keyword dictionaries: amounts (18k, 1.5 lakh, 2,50,000, 1.234,56 €, 3万), rates (24%, 6.5 pc), durations (30 years, 15 yrs, 360 months), counts.
- Map to form fields; show each detected value as a chip the user can confirm or edit; highlight anything ambiguous instead of guessing.
- Unit tests with at least 30 phrases per language.

### 4.5 What-if sliders, goal solver, comparison
- Sliders for the 2–3 most influential inputs; results update on every input with no visible lag (debounce ≤ 50 ms).
- Goal solver: "What do I need to pay to be debt-free by {date}?" — binary search over the engine to the nearest currency unit.
- Compare: pin up to 3 scenarios side by side; differences highlighted.

### 4.6 Save, share, print
- Save scenarios to localStorage ("My plans" drawer), with rename and delete.
- Share: inputs encoded in the URL query (short keys), so a link reproduces the exact result. No data stored anywhere else.
- Print / PDF: a print stylesheet producing a clean one-page summary with the chart, the insights and the disclaimer.

### 4.7 Embeddable widget (phase 4)
- A `<script>` snippet that renders a compact calculator in an iframe on other sites, with a "Powered by Numora" backlink and a locale parameter.

### 4.8 Monetization slots
- Reserved, fixed-size ad containers (no layout shift); disabled during preview.
- Partner-offer card right after the result, clearly labelled "Partner offer", with an affiliate disclosure. Placeholder content in preview.

## 5. User experience

Principles:
- **Answer first.** On every calculator, sensible local defaults are pre-filled so a result shows immediately; the visitor edits from there.
- **One screen on mobile.** The result card stays visible (sticky summary bar) while editing inputs.
- **Plain words.** Explain jargon with a tap-to-reveal tooltip ("APR — the yearly cost of borrowing, including interest").
- **Forgiving inputs.** Accept 18k, 18,000, 18.000 (de), 1.8 lakh (in); never reject on format; show errors inline, next to the field, in words.
- **Progressive disclosure.** Basic inputs first, "More options" for advanced ones.
- **Fast.** Everything under 100 ms after typing; page interactive in under 2 seconds on a mid-range phone.

Page anatomy (calculator page, top to bottom):
1. Breadcrumb · H1 matching the search ("Mortgage Payoff Calculator — UK") · one-line answer block.
2. Calculator: inputs (left/top) + result card (right/sticky on desktop, sticky bar on mobile).
3. Insights card (top 3 + watch-out).
4. Chart (balance over time, before vs after) + toggle to the schedule table.
5. Partner card.
6. "How it works" with formula, assumptions, sources, last updated, reviewer.
7. Worked example in local currency.
8. FAQ (5–8 real questions per locale).
9. Related calculators.

## 6. Visual design — futuristic but trustworthy

- Build a design system first: colour, type, spacing, radius, elevation tokens; light and dark themes (follow the system, with a toggle).
- Look: deep navy/near-black dark theme and a clean light theme; one electric accent (teal-cyan) plus one warm accent for positive outcomes; subtle glass panels with backdrop blur on the result card; soft animated gradient mesh in the hero only; thin 1 px borders; generous whitespace.
- Type: a modern variable sans (e.g. Inter or Geist) with tabular numbers for all figures; large result numbers that count up smoothly on change.
- Motion: 150–250 ms ease-out micro-interactions; respect `prefers-reduced-motion`.
- Charts: smooth SVG lines and areas, before/after in two clearly distinct colours, hover/tap tooltips, accessible data table fallback.
- Local feel: country flag + currency in the header, local example figures and city names in copy, local date and number formats, local imagery avoided (keeps it fast) — use abstract shapes instead.
- Accessibility: WCAG 2.2 AA, keyboard-complete, visible focus rings, ARIA live region announcing result changes, contrast checked in both themes.

## 7. Trust (YMYL / E-E-A-T)
- Every calculator: formula, assumptions, sources with dates, "Reviewed by [REVIEWER NAME, QUALIFICATION]", last updated.
- Disclaimer near every result and insight: "Educational estimate, not financial advice."
- Pages: About (real person), Methodology, Editorial policy, Corrections, Contact, Privacy, Terms, Affiliate disclosure.
- Consent banner for EU/UK visitors only when ads/analytics are enabled.

## 8. SEO
- Core Web Vitals: LCP < 1.8 s, CLS < 0.05, INP < 150 ms. Lighthouse ≥ 95 in every category.
- One H1 per page matching the target search in the local language; answer in the first 100 words; unique title and meta description per locale page.
- JSON-LD: `WebApplication`, `FAQPage`, `HowTo` (methodology), `BreadcrumbList`, `Organization`, `Person` (author, reviewer), `Dataset` (rule files).
- hreflang for every locale + x-default; canonical URLs; per-locale XML sitemaps + sitemap index; HTML sitemap page.
- Internal links: calculator ↔ related calculators ↔ country page ↔ city pages.
- Content per calculator page: 600–1,000 useful words (how it works, worked example, local rules, FAQ). No filler.
- Keyword research per language using local terms (e.g. "Tilgungsrechner", "住宅ローン 計算", "simulador de financiamento", "calcolo mutuo"), never translated English keywords.
- OG and Twitter cards auto-generated per page (static SVG→PNG at build time).

## 9. GEO — being found and cited by AI engines
- `robots.txt` (after launch) allows: Googlebot, Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Applebot.
- `/llms.txt` and `/llms-full.txt` describing the site, every calculator, the methodology and the data files.
- On every page a short "Answer" block (2–3 sentences with a concrete local number) placed right under the H1, plus clear question-style H2s — the format AI engines quote.
- Publish country and city rule data as open JSON with a documentation page (citable `Dataset`).
- After launch: submit to Google Search Console and Bing Webmaster Tools (ChatGPT search relies on Bing's index); ping IndexNow on every deploy.

## 10. Preview vs launch mode
- `PUBLIC_MODE=preview` (default on GitHub Pages): `<meta name="robots" content="noindex,nofollow">` on every page, `robots.txt` disallows all, ads and analytics off, a small "Preview" badge in the header.
- `PUBLIC_MODE=launch`: indexing on, robots.txt as in section 9, sitemaps submitted, custom domain set.
- Switching mode is one environment variable in the GitHub Actions workflow.

## 11. Quality gates (CI must pass on every push)
- Vitest: 100% line coverage on `/src/engine`; every formula tested against published official examples (tax authority examples, lender amortization examples).
- Insight templates and parser tested per locale.
- Playwright smoke test: each calculator loads, accepts input, shows a result, share link reproduces it.
- Lighthouse CI budgets (section 8), axe accessibility check, HTML validation, broken-link check, JSON schema validation of rule files.

## 12. Phases

1. **Foundation** — Astro project, design system, layout, locale routing, preview mode, GitHub Pages workflow; engine + insight engine + parser; Mortgage payoff calculator for US and UK end to end (all of section 4 for that calculator), with SEO and GEO files. **Stop for review.**
2. **Wave 1** — calculators 2–11 for US, UK, Canada, Australia and India (+ calculator 12 for India) and qualifying city pages.
3. **Wave 2** — Germany, Japan, France: rule files, native-language copy stubs marked for human review, local keywords.
4. **Wave 3** — Italy, Brazil, China; embeddable widget; open data docs page.
5. **Launch** — switch to launch mode, custom domain, Search Console + Bing + IndexNow, ads and partner programs on.

Before starting Phase 1, list: your assumptions, the official sources you'll use per country, and anything you need from me.

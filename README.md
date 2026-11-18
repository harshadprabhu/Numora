# Numora (working name)

Money calculators that explain your answer, localized for each country. **Preview build**: not indexed by search engines.

**Live preview:** https://harshadprabhu.github.io/Numora/

## What's in this preview
- **Mortgage / home loan payoff**: extra monthly payments, lump sum, goal solver ("mortgage-free in 15 years"), before/after chart, year-by-year schedule.
- **Debt payoff**: snowball vs avalanche side by side, debt-free date, payoff order.
- **Smart layer, no AI API**: rules-based insights, plain-language input ("300k mortgage at 6.5%, 25 years left"), save plans on the device, share links, print.
- **5 countries**: US, UK, Canada (semi-annual compounding), Australia, India (lakh formatting, "home loan" wording). Auto-detected, switchable in the header.
- Dark/light theme, mobile-first, no tracking, no server: everything runs in the browser.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine, parser and insight tests (Node 20+)
```

## Structure
```
index.html, mortgage.html, debt.html   pages
assets/engine.js     pure calculation functions
assets/insights.js   rules-based insight engine
assets/parser.js     plain-language input parser
assets/locale.js     country profiles and formatting
assets/ui.js         chart, saving, sharing helpers
tests/               node:test unit tests
PROMPT.md            the full build spec for the production site
```

## Next step
The production build (Astro, 11 countries, city pages, full SEO/GEO) is specified in [PROMPT.md](PROMPT.md). Open this repo in Claude Code and run it phase by phase.

Educational estimates, not financial advice.

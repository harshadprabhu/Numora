# Numora (working name)

Money calculators that explain your answer, localized for each country. **Preview build**: not indexed by search engines.

**Live preview:** https://harshadprabhu.github.io/Numora/

## What's in this preview
- **App-style interface**: home dashboard, bottom tab bar on phones, sticky result bar, dark/light themes, installable as an app (PWA) and works offline.
- **11 calculators**: mortgage/home loan payoff, loan/EMI, credit card, debt planner (snowball vs avalanche), rent vs buy, SIP/monthly investing, compound interest, savings goal, fixed deposit (CD/GIC/term deposit), retirement & FIRE, inflation.
- **Numi, the money assistant**: ask in plain words or by voice ("EMI on 10 lakh at 10.5% for 5 years", "when can I retire?"), get the answer with key numbers, follow up ("what if the rate is 1% lower?"), and open the full calculator pre-filled. Explains terms like APR, SIP, FIRE. Can read answers aloud. **Rules-based: no AI API, no server, nothing leaves the device.**
- **5 countries**: US, UK, Canada, Australia, India: local currency and number formats (₹ lakh grouping), local product names (CD, GIC, ISA-style bonds, term deposits, FD) and Canada's semi-annual mortgage compounding.
- Save plans on the device, share as a link, print.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine, parser, insight and Numi tests (Node 20+)
```

## Structure
```
index.html, mortgage.html, debt.html   pages
assets/engine.js     pure calculation functions
assets/insights.js   rules-based insight engine
assets/parser.js     plain-language input parser
assets/locale.js     country profiles and formatting
assets/ui.js         chart, saving, sharing helpers
assets/calcs.js      calculator catalog and configs
assets/numi-brain.js Numi: intent + number extraction + answers (pure, tested)
assets/numi.js       Numi chat UI, voice input, read-aloud
assets/shell.js      app shell: header, tab bar, Numi sheet
sw.js, manifest.webmanifest  installable app + offline
tests/               node:test unit tests
PROMPT.md            the full build spec for the production site
```

## Next step
The production build (Astro, 11 countries, city pages, full SEO/GEO) is specified in [PROMPT.md](PROMPT.md). Open this repo in Claude Code and run it phase by phase.

Educational estimates, not financial advice.

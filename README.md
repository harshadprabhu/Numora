# Numora (working name)

Money calculators that feel like an app, localized for 26 countries and 12 languages, with **Numi**, a private money assistant in the corner. **Preview build**: hidden from search engines.

**Live preview:** https://harshadprabhu.github.io/Numora/

## What's in this preview
- **One-screen app UI**: calculators in a side rail (pills on phones), inputs and live results side by side, no page scrolling on desktop. Dark-first design with animated background, ripple taps, count-up numbers, animated charts and NeoPOP-style 3D buttons. Installable (PWA), works offline.
- **11 calculators**: mortgage / home-loan prepayment, loan / EMI, credit card, debt planner (snowball vs avalanche), rent vs buy, SIP / monthly investing, compound interest, savings goal, fixed deposit (CD, GIC, term deposit, Festgeld…), retirement & FIRE, inflation.
- **Automatic localization from the network**: on first load the country is detected from the visitor's IP (only the 2-letter country code, via api.country.is with get.geojs.io as backup, then device time zone). Currency, number and date formats, language, product names and example rates follow that country. Users can still change country or language from the header chip.
- **26 countries**: US, Canada, Mexico, Brazil, UK, Ireland, Germany, France, Italy, Spain, Portugal, Switzerland, Austria, Belgium, India, China, Japan, South Korea, Singapore, Australia, New Zealand, UAE, Saudi Arabia, South Africa, Indonesia, Malaysia. Nearby unsupported countries fall back to the closest market.
- **12 languages**: English, Hindi, Spanish, French, German, Italian, Portuguese, Japanese, Chinese, Korean, Arabic (right-to-left), Indonesian.
- **Numi**: floating orb in the corner. Ask in any of the 12 languages, by typing or voice; Numi detects the language, answers in it, runs the right calculator, explains terms, handles follow-ups ("what if the rate is 1% lower?") and opens the calculator pre-filled. Rules-based: **no AI API**, nothing leaves the device.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine, parser and multilingual Numi tests (Node 20+)
```

## Structure
```
index.html                 the app shell
assets/app.js              routing, rendering, settings, saved plans
assets/calcs.js            calculator definitions (pure)
assets/engine.js           the maths (pure, tested)
assets/countries.js        26 country profiles + network detection
assets/i18n.js             all text in 12 languages
assets/numi-brain.js       Numi: language detection, intents, number extraction, answers
assets/numi.js             Numi corner widget, voice in, read-aloud
assets/parser.js           multilingual number parsing (lakh, 万, 억, juta, 1.234,56…)
assets/ui.js               chart, ripples, toasts, saved plans
PROMPT.md                  full build spec for the production site
```

Example rates are illustrative defaults. Non-English text should get a native-speaker review before launch. Educational estimates, not financial advice.

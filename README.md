# Life Is Short Browser Extension

## 1. What this project is and its purpose
Life Is Short is a browser extension designed to reduce compulsive time-wasting behavior across social/content platforms.

YouTube is the first implemented module. It tracks how many videos you watch in a day and blocks YouTube after you hit your configured daily threshold. The message shown on block is intended as a behavioral nudge: stop scrolling and spend time on higher-value actions.

The project is modular by design so new site modules (for example LinkedIn, Instagram, TikTok, etc.) can be added with separate behaviors and settings as the extension expands beyond YouTube.

## 2. How to run, test, and build the project
Prerequisites:
- Node.js 22+
- Bun 1.3.9+

Install dependencies:
```bash
bun install
```

Run in development:
```bash
bun run dev
```

Run in development targeting Firefox:
```bash
bun run dev:firefox
```

Type-check:
```bash
bun run compile
```

Run end-to-end tests:
```bash
bun run test:e2e
```

Build production extension (Chromium):
```bash
bun run build
```

Build production extension (Firefox):
```bash
bun run build:firefox
```

Create zip package (Chromium):
```bash
bun run zip
```

Create zip package (Firefox):
```bash
bun run zip:firefox
```

Load unpacked extension manually (Chromium):
1. Run `bun run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select `.output/chrome-mv3`.

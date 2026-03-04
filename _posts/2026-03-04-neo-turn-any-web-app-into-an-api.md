---
layout: post
title: "Neo: Turn Any Web App Into an API"
date: 2026-03-04
categories: [ai-agent]
tags: [neo, chrome-extension, api-discovery, browser-automation, ai-tools]
---

![Neo - Turn Any Web App Into an API](/git-blog/public/neo-header.png)

Every web app already has a complete API. The frontend calls it every time you click a button. Neo captures those calls and makes them replayable — by you or by AI.

<!-- more -->

## The Problem Nobody Solved

AI agents operating web apps today have two options, both terrible:

**Official APIs** — Most SaaS doesn't have one. The ones that do expose maybe 10% of actual functionality. Want to do something the API doesn't support? Too bad.

**Browser automation** — Screenshot the page. OCR the text. Find the button coordinates. Click. Wait. Screenshot again. Repeat. It's slow, fragile, and breaks every time the UI changes. A `200ms` API call becomes a `5-second` screenshot-parse-click cycle.

This is the state of the art in 2026. Billions of dollars of AI infrastructure, and we're still taking screenshots of web pages like it's 2015 Selenium.

## The Third Way

Here's the insight: **the browser already knows every API call**. When you click "Post" on Twitter, your browser sends a `POST /i/api/graphql/.../CreateTweet` with your auth headers, CSRF token, and the tweet body. That's the real API. It's complete, authenticated, and battle-tested — because it's what the actual product uses.

Neo sits in the browser and watches. Every `fetch()`, every `XMLHttpRequest`, every WebSocket message — captured with full headers, bodies, timing, and even which DOM element triggered the call.

```
Browse normally → Neo records all API traffic → Schema auto-generated → AI replays APIs directly
```

No reverse-engineering. No documentation reading. No API key applications. Just use the app, and Neo learns how it works.

## How It Works

### 1. Passive Capture

Install the Chrome extension. Browse normally. Neo records everything in the background — URLs, headers, request/response bodies, status codes, timing. It even tracks which button click triggered which API call (a 2-second correlation window maps DOM events to network requests).

```bash
neo capture search "CreateTweet" --method POST
# Found: POST /i/api/graphql/a1p9RWp.../CreateTweet (x-csrf-token required)
```

### 2. Schema Generation

Run one command and Neo distills all captures for a domain into a structured API schema: endpoints, auth headers, parameter patterns, response shapes, error codes.

```bash
neo schema generate x.com
```

The schema output shows which UI elements trigger which APIs and which fields vary:

```
POST /i/api/graphql/:hash/CreateTweet  (12x, 340ms) [auth: x-csrf-token]
  body: {variables, features} [varies: variables]
  ← click button.tweet-btn "Post" (8x)
```

That last line is the magic — it maps **user intent → UI element → API call → parameterizable fields**. An AI agent reading this schema knows exactly how to post a tweet without ever seeing the Twitter UI.

### 3. Replay

Execute API calls inside the browser tab's context via Chrome DevTools Protocol. Cookies, CSRF tokens, session auth — all inherited automatically.

```bash
# Smart call: schema lookup + auto-auth + auto tab selection
neo api x.com CreateTweet --body '{"variables":{"tweet_text":"hello from neo"}}'

# Or replay a specific captured call
neo replay <capture-id> --tab x.com
```

No token management. No OAuth flows. If you're logged in, Neo is logged in.

## v2: When There's No API, Drive the UI

Some actions don't have clean API endpoints. Complex multi-step wizards, drag-and-drop interfaces, canvas-based editors. For these, Neo v2 added an accessibility-tree-based UI automation layer:

```bash
neo snapshot              # Get the a11y tree with @ref mapping
neo click @14             # Click element by reference
neo fill @7 "hello"       # Fill an input field
neo press Enter           # Keyboard input
neo screenshot            # Visual capture
```

One tool, both layers. When an API exists, use it directly (fast, reliable). When it doesn't, Neo can drive the UI through the same CLI. The agent doesn't need to decide which approach to use — it has both available.

## What This Enables

**For AI agents**: Instead of the screenshot→OCR→click loop, agents call APIs directly. A task that took 30 seconds of browser automation takes 200ms of API calls. More reliable, too — API contracts are stabler than pixel positions.

**For developers**: Instant API documentation for any web app. No more digging through Network tabs manually. `neo schema show` gives you the full API map, and `neo schema openapi` exports it as OpenAPI 3.0 for Postman or code generators.

**For automation**: `neo workflow discover` finds multi-step API sequences (login → fetch data → submit form) and makes them replayable as a single command.

**For debugging**: `neo capture watch` gives you a real-time tail of all API traffic. `neo flows` shows call sequence patterns. `neo deps` traces data flow between API responses and subsequent requests.

## The Architecture

Neo has three layers:

1. **Chrome Extension** — Passive capture. Intercepts all network traffic via `chrome.webRequest` and `chrome.debugger`. Tracks DOM trigger correlation. Stores captures per-domain (500 cap, auto-cleanup).

2. **CLI** — The interface. Query captures, generate schemas, execute calls, analyze patterns. Everything goes through `neo <command>`.

3. **CDP Bridge** — Execution layer. API calls run inside the browser tab's JavaScript context via Chrome DevTools Protocol. This is what makes auth inheritance work — the call runs as if the page itself made it.

The extension also supports a WebSocket bridge (`neo bridge`) for real-time streaming — useful for monitoring or piping to other tools.

## Design Decisions

**Passive over active.** Neo doesn't inject scripts that modify page behavior. It observes from the extension layer. This means it works on any website without triggering anti-bot detection.

**Local-first.** All captures and schemas stay on your machine. No cloud, no telemetry. Your browsing patterns are your data.

**Schema as knowledge.** The generated schemas are persistent API knowledge bases. An AI agent can read a schema file and understand a web app's entire API surface without making a single request first.

**Browser context execution.** Running API calls inside the browser tab (instead of from a separate HTTP client) eliminates the entire auth problem. Whatever auth state the browser has, Neo has.

## Getting Started

```bash
git clone https://github.com/4ier/neo.git
cd neo && npm install && npm run build
npm link  # makes `neo` available globally
```

Load the extension in Chrome (developer mode → load unpacked → `extension/dist/`), browse any website, and you're capturing.

```bash
neo status                    # What do we know?
neo schema generate x.com     # Build the API map
neo api x.com HomeTimeline    # Call it
```

That's it. Three commands from zero to calling Twitter's internal API.

---

Neo is open source at [github.com/4ier/neo](https://github.com/4ier/neo). We just hit 100 ⭐ — thanks to everyone who found it useful. If you're building AI agents that interact with web apps, give it a try. The screenshot-and-click era is over.

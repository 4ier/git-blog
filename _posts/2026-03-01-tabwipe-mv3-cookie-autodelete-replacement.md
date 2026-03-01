---
layout: post
title: "How I Built the MV3 Replacement for Cookie AutoDelete"
date: 2026-03-01
categories: [projects]
tags: [chrome-extension, mv3, privacy, tabwipe]
---

Cookie AutoDelete was the most popular cookie management extension on Chrome. When Google forced the Manifest V3 migration, CAD died — their own README says "MV3 makes this extension impossible as designed."

I built TabWipe to fill that gap. Here's how.

## The Problem

Every website drops cookies that track you. Chrome's built-in "Clear on exit" is a nuclear option — it deletes everything, including sites where you want to stay logged in. CAD solved this elegantly: close a tab, and cookies for that domain get cleaned up automatically.

MV3 killed CAD because it relied on two things that no longer exist:

1. **Persistent background pages** — MV3 replaces these with service workers that can be killed at any time
2. **In-memory state** — CAD tracked which domains had open tabs in memory. When the service worker dies, that state vanishes

## The Insight

The key word in "MV3 makes this extension impossible **as designed**" is "as designed." Their architecture couldn't be ported. But the core user need — close tab, delete cookies — is fully achievable with a different approach.

## The Architecture

TabWipe's design principle: **never trust memory.**

```
tab close event
    → chrome.tabs.onRemoved (wakes service worker)
    → chrome.tabs.query({}) (rebuild state from scratch)  
    → domain has other open tabs? → do nothing
    → no other tabs? → schedule cleanup via chrome.alarms
    → alarm fires → chrome.cookies.remove()
```

Every API in this chain is fully supported in MV3. The critical difference from CAD: instead of maintaining an in-memory map of open domains, TabWipe calls `chrome.tabs.query({})` every single time to get the ground truth. Service worker gets killed? Fine. Next event wakes it up and it rebuilds from scratch.

## Why chrome.alarms Instead of setTimeout

In a service worker, `setTimeout` is unreliable — the SW can be killed before the timer fires. `chrome.alarms` persists across SW restarts. TabWipe schedules a cleanup alarm when a tab closes, plus a fallback sweep every 5 minutes to catch anything that slipped through.

## The Result

The core logic is ~500 lines of JavaScript. It took one weekend from idea to working extension. The entire extension (including Pro features, popup UI, options page, and license system) is under 3,000 lines.

Tested: closing a GitHub tab deleted all 13 of its cookies within seconds. Whitelisted domains are untouched.

## What's Next

TabWipe is [open source on GitHub](https://github.com/4ier/tabwipe) and heading to the Chrome Web Store. Free tier covers the core functionality. Pro ($3.99 one-time) adds power features like wildcard rules, tracking cookie detection, and scheduled cleanup.

If you used Cookie AutoDelete and miss it, [give TabWipe a try](https://4ier.github.io/tabwipe/).

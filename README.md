# Slash Multi Search

A lightweight Microsoft Edge extension for searching multiple search engines directly from the address bar with a single `/` command.

**中文简介：** 在 Edge 地址栏用 `/` 快速同时搜索 Bing、Google、Yandex、百度等搜索引擎。最多 4 个搜索引擎会在同一个 Tab 中以网格方式显示；选择 5 个或更多时会自动创建 Edge 标签组。

## Features

- One simple `/` trigger
- Search multiple engines from the Edge address bar
- Up to 4 engines displayed together in one tab
- 5 or more engines automatically opened as an Edge tab group
- Address-bar suggestions through the Omnibox API
- Fast mode: commands such as `/23 query` work without entering Omnibox keyword mode when the browser's default search engine is supported
- No backend server or proxy
- Easy to extend with additional search engines

## Search engine codes

| Code | Search engine |
| --- | --- |
| `1` | Bing |
| `2` | Google |
| `3` | Yandex |
| `4` | Baidu |
| `5` | DuckDuckGo |
| `6` | Brave Search |

The default selection is `12`, so `/ query` means Bing + Google.

Two slash shortcuts are also available:

| Command prefix | Equivalent engine codes |
| --- | --- |
| `//` | `/123` |
| `///` | `/1234` |

## Usage

### Quick mode

Quick mode requires Edge's default search engine to be one of the URL formats recognized by this extension: Bing, Google (including common localized domains), Yandex (including its supported regional domains), Baidu, DuckDuckGo, or Brave Search. If another default search engine is configured, use Address-bar hint mode instead.

Type a slash command directly into the Edge address bar:

```text
/ cats
```

This is equivalent to:

```text
/12 cats
```

and opens Bing + Google together in one tab.

More examples:

| Command | Result |
| --- | --- |
| `/ cats` | Bing + Google in one tab |
| `// cats` | Bing + Google + Yandex in three columns |
| `/// cats` | Bing + Google + Yandex + Baidu in a 2×2 grid |
| `/1 cats` | Bing only |
| `/2 cats` | Google only |
| `/3 cats` | Yandex only |
| `/23 cats` | Google + Yandex in one tab |
| `/123 cats` | Bing + Google + Yandex in one tab |
| `/1234 cats` | Bing + Google + Yandex + Baidu in a 2×2 grid |
| `/12345 cats` | 5 engines in an Edge tab group |
| `/123456 cats` | All 6 engines in an Edge tab group |

Engine order is normalized according to the numeric code order.

### Address-bar hint mode

You can also use Edge's Omnibox keyword mode:

1. Type `/` in the address bar.
2. Press **Space** or **Tab**.
3. Edge will show the extension's search hints.
4. Enter a query, optionally prefixed with engine codes.
5. Press **Enter**.

Examples after entering `/` keyword mode:

```text
cats
/ cats
// cats
23 cats
1234 cats
12345 cats
```

In keyword mode the first `/` has already activated the extension, so entering `/ cats` produces the complete `// cats` shortcut, and entering `// cats` produces `/// cats`.

The suggestion area shows the engine combination and whether the result will use a single page or a tab group.

## Display behavior

Slash Multi Search automatically chooses the display mode based on the number of selected engines.

### 1 engine

The selected search engine opens directly in the current tab.

### 2 engines

Both search engines are displayed side by side.

```text
┌──────────────────┬──────────────────┐
│       Bing       │      Google      │
└──────────────────┴──────────────────┘
```

### 3 engines

The extension uses three equal-width columns.

```text
┌────────────┬────────────┬────────────┐
│    Bing    │   Google   │   Yandex   │
└────────────┴────────────┴────────────┘
```

### 4 engines

The extension uses a 2×2 grid.

```text
┌──────────────────┬──────────────────┐
│       Bing       │      Google      │
├──────────────────┼──────────────────┤
│      Yandex      │      Baidu       │
└──────────────────┴──────────────────┘
```

### 5+ engines

Instead of squeezing more pages into the grid, the extension opens the selected engines as an Edge tab group.

## Installation

This project is currently intended to be installed as an unpacked extension.

1. Download or clone this repository.
2. Open Edge and go to:

   ```text
   edge://extensions/
   ```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder containing `manifest.json`.

If you update the source code later, return to `edge://extensions/` and click **Reload** on the extension card.

## Project structure

```text
edge-slash-multi-search/
├── manifest.json
├── engines.js
├── background.js
├── split.html
├── split.js
├── split.css
├── tests/
│   └── background.test.js
├── package.json
├── README.md
└── README.txt
```

### `background.js`

Handles:

- Slash command parsing
- Search engine selection
- Omnibox suggestions
- Fast-mode URL detection
- Single-tab vs. tab-group routing
- Temporary framing rules for grid tabs

### `engines.js`

Contains the shared search-engine URLs, ordering, defaults, and framing-domain list used by both the service worker and grid page.

### `split.html`, `split.js`, `split.css`

Render the multi-engine grid used when 2–4 engines are selected.

## How it works

There are two input paths.

### Omnibox mode

The extension registers `/` as its Omnibox keyword. After `/` is activated with Space or Tab, the extension receives the address-bar input directly and can show dynamic suggestions.

### Fast mode

Commands such as:

```text
/23 cats
// cats
/// cats
```

can also be typed directly without explicitly entering Omnibox keyword mode.

In this case, Edge first sends the text to the browser's normal search engine. If that search engine uses one of the supported URL formats listed above, the extension extracts the slash command and immediately redirects the tab into Slash Multi Search.

## Why does the grid mode need extra permissions?

Major search engines generally prevent their pages from being embedded inside an `<iframe>` by sending headers such as:

- `X-Frame-Options`
- `Content-Security-Policy`

For grid mode, Slash Multi Search uses a `declarativeNetRequest` session rule to remove those response headers **only for supported-domain sub-frame requests in the specific grid tab**.

The rule is removed as soon as the tab leaves the grid page, switches to single-engine or tab-group mode, or is closed.

This is what makes it possible to display multiple original search pages in one tab instead of scraping, proxying, or recreating their results.

### Security note

Removing anti-framing headers weakens protections that those sites intentionally enable against embedding. In particular, the browser API removes the complete `Content-Security-Policy` response header; it cannot remove only the `frame-ancestors` directive. This also disables the other protections expressed by that CSP for the embedded document. The extension limits the rule to the active grid tab, supported search-engine domains, and sub-frame requests, and removes it on navigation, but users should understand this trade-off before installing the extension.

If a search engine changes its anti-embedding behavior in the future, grid mode for that engine may require an update.

Tab-group mode does not depend on iframe embedding and is therefore less affected by these restrictions.

## Permissions

The extension currently requests:

| Permission | Purpose |
| --- | --- |
| `tabs` | Open, update, and inspect search tabs |
| `tabGroups` | Group searches when 5+ engines are selected |
| `declarativeNetRequest` | Allow supported search pages to render inside the grid |
| Host permissions | Authorize response-header modification for supported search-engine domains |

The extension does not require a backend server.

Search queries are sent directly to the selected search engines.

## Adding another search engine

Search engines are defined once in `engines.js`.

For example:

```javascript
"7": {
  name: "Example",
  url: (q) => `https://example.com/search?q=${encodeURIComponent(q)}`
}
```

You will also need to:

1. Add the new engine and code to the shared configuration in `engines.js`.
2. Add the site's domain to the framing domain list if it should support grid mode.
3. Add the required domain to `host_permissions` and the extension page `frame-src` policy in `manifest.json`.
4. Update the fast-mode URL extraction logic if the new engine should be recognized as the browser's default search engine.
5. Update the Omnibox hint text if you want the new engine shown in suggestions.

If the total number of supported engines grows beyond single-digit codes, the command syntax may need to be redesigned.

## Known limitations

- Built and tested primarily for Microsoft Edge.
- Other Chromium-based browsers may work, but are not the primary target.
- Search engines may change their URLs, CSP rules, or iframe behavior at any time.
- Fast mode works only when the browser's default search engine uses one of the supported URL formats listed in the Quick mode section.
- Some login, popup, or navigation flows inside embedded search pages may behave differently from normal top-level tabs.

## Ideas for future versions

Possible improvements include:

- Options page for enabling/disabling engines
- Custom engine codes
- User-defined search engines
- Configurable default combination
- Configurable threshold between grid and tab-group mode
- Drag-to-resize grid panels
- Remembering favorite engine combinations
- Keyboard shortcuts
- Chrome and other Chromium-browser testing

## Development checks

The project uses the built-in test runner from Node.js 18 or newer and has no npm runtime dependencies.

```text
npm test
npm run check
```

The tests cover command and slash-shortcut parsing, fast-mode domain validation, the three-column layout, concurrent framing-rule setup, navigation cleanup, single-engine cleanup, and tab-group rollback.

## Contributing

Issues and pull requests are welcome.

When adding a new search engine, please verify:

- Search URL formatting
- Grid rendering
- Redirect behavior
- Omnibox behavior
- Required host permissions
- Whether the site depends on additional anti-framing headers

## License

A license has not been included yet.

If you intend to publish this project as open source, consider adding a `LICENSE` file before publishing. The MIT License is a common choice for small browser-extension projects.

const ENGINES = {
  "1": { name: "Bing", url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  "2": { name: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  "3": { name: "Yandex", url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}` },
  "4": { name: "百度", url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
  "5": { name: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  "6": { name: "Brave", url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` }
};

const ENGINE_ORDER = ["1", "2", "3", "4", "5", "6"];
const DEFAULT_CODES = ["1", "2"];
const FRAME_DOMAINS = [
  "bing.com",
  "google.com",
  "google.com.hk",
  "google.com.sg",
  "yandex.com",
  "baidu.com",
  "duckduckgo.com",
  "search.brave.com"
];

function isHost(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

function extractSearchQuery(urlString) {
  try {
    const u = new URL(urlString);
    const host = u.hostname.toLowerCase();

    if (isHost(host, "bing.com") && u.pathname.startsWith("/search")) return u.searchParams.get("q");
    if (/^(.+\.)?google\.[a-z.]+$/i.test(host) && u.pathname.startsWith("/search")) return u.searchParams.get("q");
    if (/^(.+\.)?yandex\.[a-z.]+$/i.test(host) && u.pathname.startsWith("/search")) return u.searchParams.get("text");
    if (isHost(host, "baidu.com") && u.pathname.startsWith("/s")) return u.searchParams.get("wd");
    if (isHost(host, "duckduckgo.com")) return u.searchParams.get("q");
    if (host === "search.brave.com" && u.pathname.startsWith("/search")) return u.searchParams.get("q");

    return null;
  } catch {
    return null;
  }
}

function normalizeCodes(codes) {
  const selected = new Set(codes);
  return ENGINE_ORDER.filter((code) => selected.has(code));
}

// Parses text AFTER the slash. Examples:
// "cats"      -> 12 + cats
// "23 cats"   -> 23 + cats
// "12345 AI"  -> 12345 + AI
function parseSlashBody(raw) {
  if (raw == null) return null;

  let text = raw.trim();
  if (!text) return null;

  const match = text.match(/^([1-6]+)(?=\s|$)/);
  let codes = DEFAULT_CODES;

  if (match) {
    codes = normalizeCodes(match[1].split(""));
    text = text.slice(match[0].length).trimStart();
  }

  if (!text || codes.length === 0) return null;
  return { codes, query: text };
}

function parseSlashCommand(raw) {
  if (!raw) return null;
  const text = raw.trimEnd();
  if (!text.startsWith("/") || text.startsWith("//")) return null;
  return parseSlashBody(text.slice(1));
}

function engineNames(codes) {
  return codes.map((code) => ENGINES[code]?.name).filter(Boolean).join(" + ");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function modeLabel(codes) {
  if (codes.length === 1) return "直接打开";
  if (codes.length <= 4) return "同页显示";
  return "标签组";
}

async function getSessionRuleIdsForTab(tabId) {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules
    .filter((rule) => rule.condition?.tabIds?.includes(tabId))
    .map((rule) => rule.id);
}

async function enableFramingForTab(tabId) {
  const existingRules = await chrome.declarativeNetRequest.getSessionRules();
  const oldIds = existingRules
    .filter((rule) => rule.condition?.tabIds?.includes(tabId))
    .map((rule) => rule.id);

  let nextId = existingRules.reduce((max, rule) => Math.max(max, rule.id), 1000) + 1;

  const addRules = FRAME_DOMAINS.map((domain) => ({
    id: nextId++,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "x-frame-options", operation: "remove" },
        { header: "content-security-policy", operation: "remove" }
      ]
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: ["sub_frame"],
      tabIds: [tabId]
    }
  }));

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: oldIds,
    addRules
  });
}

async function openGrid(tabId, codes, query) {
  if (codes.length === 1) {
    await chrome.tabs.update(tabId, { url: ENGINES[codes[0]].url(query) });
    return;
  }

  await enableFramingForTab(tabId);

  const pageUrl = new URL(chrome.runtime.getURL("split.html"));
  pageUrl.searchParams.set("engines", codes.join(""));
  pageUrl.searchParams.set("q", query);
  await chrome.tabs.update(tabId, { url: pageUrl.toString() });
}

async function openGroup(tabId, codes, query) {
  const sourceTab = await chrome.tabs.get(tabId);
  const tabIds = [tabId];

  await chrome.tabs.update(tabId, {
    url: ENGINES[codes[0]].url(query),
    active: true
  });

  for (let i = 1; i < codes.length; i++) {
    const newTab = await chrome.tabs.create({
      windowId: sourceTab.windowId,
      index: sourceTab.index + i,
      url: ENGINES[codes[i]].url(query),
      active: false
    });
    tabIds.push(newTab.id);
  }

  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, {
    title: `搜索：${query}`,
    collapsed: false
  });
}

async function executeSearch(tabId, codes, query) {
  if (codes.length <= 4) {
    await openGrid(tabId, codes, query);
  } else {
    await openGroup(tabId, codes, query);
  }
}

// ---- Omnibox hint mode ----------------------------------------------------
// Type "/" then Space/Tab to enter extension keyword mode.
chrome.omnibox.setDefaultSuggestion({
  description: "<match>多引擎搜索</match> <dim>1 Bing · 2 Google · 3 Yandex · 4 百度 · 5 DuckDuckGo · 6 Brave | ≤4 同页，≥5 标签组</dim>"
});

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const trimmed = text.trimStart();
  const parsed = parseSlashBody(trimmed);

  if (parsed) {
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>${escapeXml(engineNames(parsed.codes))}</match> <dim>· ${modeLabel(parsed.codes)} · Enter 搜索</dim>`
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: "<match>输入编号 + 关键词</match> <dim>默认 12=Bing+Google | 3=Yandex | 4=百度 | 1234=四宫格 | 12345=标签组</dim>"
    });
  }

  // If the user already typed a query without explicit engine numbers,
  // provide useful one-click alternatives in the dropdown.
  const explicitCode = /^([1-6]+)(?=\s|$)/.test(trimmed);
  if (trimmed && !explicitCode) {
    const q = trimmed.trim();
    const safeQ = escapeXml(q);
    suggest([
      { content: `12 ${q}`, description: `<match>Bing + Google</match> <dim>同页搜索 “${safeQ}”</dim>` },
      { content: `3 ${q}`, description: `<match>Yandex</match> <dim>搜索 “${safeQ}”</dim>` },
      { content: `4 ${q}`, description: `<match>百度</match> <dim>搜索 “${safeQ}”</dim>` },
      { content: `1234 ${q}`, description: `<match>Bing + Google + Yandex + 百度</match> <dim>四宫格</dim>` },
      { content: `12345 ${q}`, description: `<match>5 个搜索引擎</match> <dim>标签组</dim>` }
    ]);
  } else {
    suggest([]);
  }
});

chrome.omnibox.onInputEntered.addListener(async (text) => {
  const command = parseSlashBody(text);
  if (!command) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await executeSearch(tab.id, command.codes, command.query);
  } catch (error) {
    console.error("Slash Multi Search omnibox failed:", error);
  }
});

// ---- Fast mode ------------------------------------------------------------
// Keeps /23 keyword working even without entering omnibox keyword mode.
const processingTabs = new Set();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url || processingTabs.has(tabId)) return;

  const rawQuery = extractSearchQuery(changeInfo.url);
  const command = parseSlashCommand(rawQuery);
  if (!command) return;

  processingTabs.add(tabId);

  try {
    await executeSearch(tabId, command.codes, command.query);
  } catch (error) {
    console.error("Slash Multi Search fast mode failed:", error);
  } finally {
    setTimeout(() => processingTabs.delete(tabId), 500);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const ruleIds = await getSessionRuleIdsForTab(tabId);
    if (ruleIds.length) {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds });
    }
  } catch {
    // Ignore cleanup failures for a tab that is already gone.
  }
});

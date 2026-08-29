const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createEvent() {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    listeners
  };
}

function createHarness(overrides = {}) {
  let rules = [];
  let nextTabId = 100;
  const removedTabs = [];
  const updatedTabs = [];
  const onUpdated = createEvent();
  const onRemoved = createEvent();

  const chrome = {
    declarativeNetRequest: {
      async getSessionRules() {
        return structuredClone(rules);
      },
      async updateSessionRules({ removeRuleIds = [], addRules = [] }) {
        rules = rules.filter((rule) => !removeRuleIds.includes(rule.id));
        for (const rule of addRules) {
          if (rules.some((existing) => existing.id === rule.id)) {
            throw new Error(`Duplicate rule ID: ${rule.id}`);
          }
          rules.push(structuredClone(rule));
        }
      }
    },
    runtime: {
      getURL(file) {
        return `chrome-extension://test-extension/${file}`;
      }
    },
    omnibox: {
      setDefaultSuggestion() {},
      onInputChanged: createEvent(),
      onInputEntered: createEvent()
    },
    tabs: {
      onUpdated,
      onRemoved,
      async query() {
        return [{ id: 1 }];
      },
      async get(tabId) {
        return { id: tabId, windowId: 1, index: 0, url: "https://example.com/original" };
      },
      async create(options) {
        return { id: nextTabId++, ...options };
      },
      async update(tabId, options) {
        updatedTabs.push({ tabId, options });
        return { id: tabId, ...options };
      },
      async group() {
        return 50;
      },
      async ungroup() {},
      async remove(tabIds) {
        removedTabs.push(...(Array.isArray(tabIds) ? tabIds : [tabIds]));
      }
    },
    tabGroups: {
      async update() {}
    }
  };

  Object.assign(chrome.tabs, overrides.tabs);
  Object.assign(chrome.tabGroups, overrides.tabGroups);

  const context = vm.createContext({
    chrome,
    console,
    setTimeout,
    URL,
    URLSearchParams
  });
  context.importScripts = (...files) => {
    for (const file of files) {
      const importedSource = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      vm.runInContext(importedSource, context, { filename: file });
    }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  vm.runInContext(source, context, { filename: "background.js" });

  return {
    call(expression) {
      return vm.runInContext(expression, context);
    },
    getRules() {
      return structuredClone(rules);
    },
    onUpdated,
    removedTabs,
    updatedTabs
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("parses engine codes, removes duplicates, and restores numeric order", () => {
  const harness = createHarness();
  assert.deepEqual(plain(harness.call('parseSlashBody("3321 cats")')), {
    codes: ["1", "2", "3"],
    query: "cats"
  });
  assert.deepEqual(plain(harness.call('parseSlashBody("cats")')), {
    codes: ["1", "2"],
    query: "cats"
  });
});

test("fast-mode URL detection accepts supported domains but rejects lookalikes", () => {
  const harness = createHarness();
  assert.equal(
    harness.call('extractSearchQuery("https://www.google.com/search?q=%2F23+cats")'),
    "/23 cats"
  );
  assert.equal(
    harness.call('extractSearchQuery("https://www.google.co.uk/search?q=%2F23+cats")'),
    "/23 cats"
  );
  assert.equal(
    harness.call('extractSearchQuery("https://google.com.example/search?q=%2F23+cats")'),
    null
  );
});

test("concurrent grid setup creates unique one-rule-per-tab rules", async () => {
  const harness = createHarness();
  const enableFramingForTab = harness.call("enableFramingForTab");

  await Promise.all([enableFramingForTab(10), enableFramingForTab(11)]);

  const rules = harness.getRules();
  assert.equal(rules.length, 2);
  assert.equal(new Set(rules.map((rule) => rule.id)).size, 2);
  assert.deepEqual(rules.map((rule) => rule.condition.tabIds[0]).sort(), [10, 11]);
  assert.ok(rules.every((rule) => rule.condition.requestDomains.length === 8));
});

test("navigating away from the grid removes that tab's framing rule", async () => {
  const harness = createHarness();
  const enableFramingForTab = harness.call("enableFramingForTab");
  await enableFramingForTab(12);

  assert.equal(harness.getRules().length, 1);
  await harness.onUpdated.listeners[0](12, { url: "https://example.com/elsewhere" });
  assert.equal(harness.getRules().length, 0);
});

test("a single-engine search removes an existing framing rule", async () => {
  const harness = createHarness();
  const enableFramingForTab = harness.call("enableFramingForTab");
  const openGrid = harness.call("openGrid");
  await enableFramingForTab(13);

  await openGrid(13, ["1"], "cats");

  assert.equal(harness.getRules().length, 0);
  assert.equal(harness.updatedTabs.at(-1).options.url, "https://www.bing.com/search?q=cats");
});

test("a failed tab group removes new tabs and restores the source tab", async () => {
  const harness = createHarness({
    tabs: {
      async group() {
        throw new Error("group failed");
      }
    }
  });
  const openGroup = harness.call("openGroup");

  await assert.rejects(openGroup(14, ["1", "2", "3", "4", "5"], "cats"), /group failed/);

  assert.deepEqual(harness.removedTabs, [100, 101, 102, 103]);
  assert.equal(harness.updatedTabs.at(-1).options.url, "https://example.com/original");
});

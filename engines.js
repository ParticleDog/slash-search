globalThis.SLASH_MULTI_SEARCH_CONFIG = Object.freeze({
  engines: Object.freeze({
    "1": { name: "Bing", url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
    "2": { name: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
    "3": { name: "Yandex", url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}` },
    "4": { name: "百度", url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
    "5": { name: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
    "6": { name: "Brave", url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` }
  }),
  engineOrder: Object.freeze(["1", "2", "3", "4", "5", "6"]),
  defaultCodes: Object.freeze(["1", "2"]),
  frameDomains: Object.freeze([
    "bing.com",
    "google.com",
    "google.com.hk",
    "google.com.sg",
    "yandex.com",
    "baidu.com",
    "duckduckgo.com",
    "search.brave.com"
  ])
});

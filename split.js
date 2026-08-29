const ENGINES = {
  "1": { name: "Bing", url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  "2": { name: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  "3": { name: "Yandex", url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}` },
  "4": { name: "百度", url: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
  "5": { name: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  "6": { name: "Brave", url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` }
};

const params = new URLSearchParams(location.search);
const query = params.get("q") || "";
const codes = (params.get("engines") || "12")
  .split("")
  .filter((code, index, array) => ENGINES[code] && array.indexOf(code) === index)
  .slice(0, 4);

const grid = document.getElementById("grid");
grid.dataset.count = String(codes.length || 1);
document.title = query ? `搜索：${query}` : "Multi Search";

for (const code of codes) {
  const engine = ENGINES[code];

  const panel = document.createElement("section");
  panel.className = "panel";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = engine.name;

  const frame = document.createElement("iframe");
  frame.src = engine.url(query);
  frame.title = `${engine.name}: ${query}`;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.setAttribute(
    "sandbox",
    "allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
  );

  panel.append(label, frame);
  grid.append(panel);
}

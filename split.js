const { engines: ENGINES } = globalThis.SLASH_MULTI_SEARCH_CONFIG;

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

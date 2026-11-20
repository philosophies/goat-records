const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const loadInterface = require("./load-interface.cjs");
const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name));

async function checkWorker() {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "landscape");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./index.html");
  for (const [name, width, height] of [
    ["goat-192.png", 192, 192], ["goat-512.png", 512, 512],
    ["play-store-icon.png", 512, 512], ["play-store-feature.png", 1024, 500],
  ]) {
    const png = read("icons/" + name);
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
  }
  const scope = "https://example.test/games/goat/";
  const callbacks = {};
  const files = new Set();
  const removed = [];
  let current;
  let claimed = false;
  const cache = {
    addAll: async (requests) => {
      for (const request of requests) {
        assert.equal(request.cache, "reload");
        assert.ok(request.url.startsWith(scope));
        const file = request.url.slice(scope.length);
        assert.ok(read(file).length);
        files.add(request.url);
      }
    },
    match: async (url) => files.has(url) ? url : undefined,
  };
  vm.runInNewContext(read("sw.js").toString(), {
    URL, Request,
    self: {
      registration: { scope },
      clients: { claim: async () => { claimed = true; } },
      addEventListener: (type, callback) => { callbacks[type] = callback; },
    },
    caches: {
      open: async (name) => { current = name; return cache; },
      keys: async () => [current, "goat-records-shell-old", "unrelated-cache"],
      delete: async (name) => { removed.push(name); },
    },
    fetch: () => { throw Error("Offline"); },
  }, { filename: "sw.js" });
  let pending;
  for (const type of ["install", "activate"]) {
    callbacks[type]({ waitUntil: (promise) => { pending = promise; } });
    await pending;
  }
  assert.deepEqual(removed, ["goat-records-shell-old"]);
  assert.equal(claimed, true);
  const shell = ["index.html", ...manifest.icons.map(({ src }) => src)];
  for (const [, asset] of read("index.html").toString().matchAll(/(?:href|src)="([^"]+)"/g)) shell.push(asset);
  for (const file of shell) assert.ok(files.has(scope + file), `${file} is available offline`);
  function fromWorker(url, mode = "same-origin") {
    let response;
    callbacks.fetch({ request: { url, mode, method: "GET" }, respondWith: (value) => { response = value; } });
    return response;
  }
  assert.equal(await fromWorker(scope, "navigate"), scope + "index.html");
  assert.equal(await fromWorker(scope + "src/systems/events.js"), scope + "src/systems/events.js");
  assert.equal(fromWorker("https://example.test/other/"), undefined);
}

function panelBrowser(protocol) {
  const callbacks = {};
  const elements = new Map();
  const states = [null];
  let place = 0;
  const history = {
    get state() { return states[place]; },
    pushState(state) {
      states.splice(place + 1, states.length, state);
      place++;
    },
    go(n) {
      place += n;
      callbacks.popstate({ state: this.state });
    },
  };
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { dataset: {}, classList: { toggle() {} } });
    return elements.get(id);
  };
  let registered;
  const context = vm.createContext({
    console,
    document: {
      getElementById: element, querySelectorAll: () => [],
      addEventListener: (name, callback) => { callbacks[name] = callback; },
    },
    window: { history, addEventListener: (name, callback) => { callbacks[name] = callback; } },
    localStorage: { getItem: () => null, setItem() {} },
    location: { protocol },
    navigator: { serviceWorker: { register: async (name) => { registered = name; } } },
    setTimeout, Blob, URL,
  });
  loadInterface(context);
  const click = (tab) => callbacks.click({ target: { closest: () => ({ dataset: { tab } }) } });
  const title = () => element("drawerTitle").textContent;
  return { history, element, click, title, registered };
}

(async () => {
  await checkWorker();
  const phone = panelBrowser("https:");
  assert.equal(phone.registered, "sw.js");
  phone.click("phone");
  assert.equal(phone.title(), "Phone");
  phone.click("phone:inbox");
  assert.match(phone.element("content").innerHTML, /Nothing needs you right now/);
  assert.equal(phone.history.state.goatPanel.depth, 2);
  phone.history.go(-1);
  assert.match(phone.element("content").innerHTML, /data-tab="phone:inbox"/);
  phone.history.go(-1);
  assert.equal(phone.element("drawer").hidden, true);
  phone.history.go(1);
  assert.equal(phone.title(), "Phone");
  assert.equal(panelBrowser("file:").registered, undefined);
  console.log("Installable shell, offline resources, and browser Back passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

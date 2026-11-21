(function () {
  var root = document.querySelector("[data-wallpaper]");
  if (!root) return;
  var data = JSON.parse(root.getAttribute("data-wallpaper"));
  var img = root.querySelector("img");
  var sources = root.querySelectorAll("source");
  var current = 0;

  function need() {
    var w = Math.max(innerWidth, innerHeight * data.aspect);
    var dpr = window.devicePixelRatio || 1;
    var save = navigator.connection && navigator.connection.saveData;
    var px = Math.ceil(w * dpr - 1);
    return save ? Math.min(px, data.variants[0].w) : px;
  }

  function pick() {
    var target = need();
    for (var i = 0; i < data.variants.length; i++) if (data.variants[i].w >= target) return data.variants[i];
    return data.variants[data.variants.length - 1];
  }

  function apply() {
    var v = pick();
    if (v.w <= current) return;
    current = v.w;
    sources.forEach(function (s) { s.srcset = data.base + v[s.getAttribute("data-format")]; });
    img.src = data.base + v[data.fallback];
    root.setAttribute("data-width", v.w);
    pixelate(v);
  }

  function pixelate(v) {
    if (!data.pixel) return;
    var shown = Math.max(innerWidth, innerHeight * data.aspect) * (window.devicePixelRatio || 1);
    img.style.imageRendering = shown >= v.w - 1 ? "pixelated" : "auto";
  }

  function loaded() {
    var done = function () { root.classList.add("is-loaded"); };
    if (img.decode) img.decode().then(done, done); else done();
  }

  img.addEventListener("load", loaded);

  function useBlob(url, v) {
    current = v.w;
    sources.forEach(function (s) { s.removeAttribute("srcset"); });
    img.src = url;
    root.setAttribute("data-width", v.w);
    pixelate(v);
  }

  function plan(avif) {
    var v = pick();
    var order = data.formats || ["avif", "webp", "jpeg"];
    for (var i = 0; i < order.length; i++) {
      var f = order[i];
      if (!v[f]) continue;
      if (f === "avif" && !avif) continue;
      return { v: v, url: data.base + v[f], format: f };
    }
    return { v: v, url: data.base + v[data.fallback], format: data.fallback };
  }

  if (document.documentElement.getAttribute("data-boot") !== "boot") apply();

  var t;
  addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      apply();
      for (var i = 0; i < data.variants.length; i++) if (data.variants[i].w === current) pixelate(data.variants[i]);
    }, 200);
  });
  (function watchDpr() {
    var mq = matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
    mq.addEventListener("change", function () { apply(); watchDpr(); }, { once: true });
  })();

  window.__wallpaper = { width: function () { return current; }, image: img, apply: apply, plan: plan, useBlob: useBlob };
})();

(function () {
  var root = document.documentElement;
  var bootEl = document.getElementById("boot");
  var lockEl = document.getElementById("lock");
  if (!bootEl || !lockEl) return;
  var cfg = JSON.parse(bootEl.getAttribute("data-config"));
  var css = getComputedStyle(root);
  var tok = function (name) { return parseFloat(css.getPropertyValue(name)) || 0; };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  function done(mode) {
    root.setAttribute("data-boot", "none");
    try { localStorage.setItem("shell:booted", "1"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("shell:booted", { detail: { mode: mode, saveData: saveData } }));
  }

  function fade(el, ms) {
    if (reduced || !el.animate) return Promise.resolve();
    return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease", fill: "forwards" }).finished.then(function (a) { return a; }, function () {});
  }

  function lock(auto) {
    root.setAttribute("data-boot", "lock");
    lockEl.style.opacity = "";
    lockEl.querySelectorAll(".lock-time, .lock-user").forEach(function (n) { n.getAnimations && n.getAnimations().forEach(function (a) { a.cancel(); }); });
    var dateEl = lockEl.querySelector("[data-lock-date]");
    var clockEl = lockEl.querySelector("[data-lock-clock]");
    var dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
    var timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    var tick = function () {
      var now = new Date();
      dateEl.textContent = dateFmt.format(now);
      clockEl.textContent = timeFmt.format(now).replace(/\s?[AP]M$/i, "");
    };
    tick();
    var clock = setInterval(tick, 1000);
    var gone = false;
    var unlock = function () {
      if (gone) return;
      gone = true;
      clearInterval(clock);
      clearTimeout(timer);
      removeEventListener("keydown", unlock, true);
      lockEl.removeEventListener("pointerdown", unlock);
      var ms = tok("--lock-exit-ms");
      if (!reduced && lockEl.animate) {
        lockEl.querySelector(".lock-time").animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-28px)", opacity: 0 }], { duration: ms, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" });
        lockEl.querySelector(".lock-user").animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms * 0.7, fill: "forwards" });
      }
      setTimeout(function () { done("lock"); }, reduced ? 0 : ms * 0.6);
    };
    var timer = auto ? setTimeout(unlock, tok("--lock-auto-ms")) : 0;
    addEventListener("keydown", unlock, true);
    lockEl.addEventListener("pointerdown", unlock);
    lockEl.focus({ preventScroll: true });
  }

  document.addEventListener("shell:action", function (e) {
    if (e.detail === "lock") lock(false);
  });

  var mode = root.getAttribute("data-boot");
  if (mode === "lock") {
    lock(true);
    return;
  }
  if (mode !== "boot") return;

  var canvas = bootEl.querySelector(".boot-logo");
  var fill = bootEl.querySelector(".boot-fill");
  var cells = tok("--boot-logo-cells");
  var logo = tok("--boot-logo");
  var dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(logo * dpr);
  canvas.height = Math.round(logo * dpr);
  var ctx = canvas.getContext("2d");

  var grid = document.createElement("canvas");
  grid.width = cells;
  grid.height = cells;
  var g = grid.getContext("2d");
  g.scale(cells / 16, cells / 16);
  cfg.monogram.forEach(function (d) { g.fill(new Path2D(d)); });
  var px = g.getImageData(0, 0, cells, cells).data;
  var on = [];
  for (var i = 0; i < cells * cells; i++) if (px[i * 4 + 3] > 110) on.push(i);
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (var j = on.length - 1; j > 0; j--) {
    var k = Math.floor(rnd() * (j + 1));
    var t = on[j]; on[j] = on[k]; on[k] = t;
  }

  var edge = function (n) { return Math.round((n * canvas.width) / cells); };
  function cell(index) {
    var x = index % cells, y = (index / cells) | 0;
    ctx.fillRect(edge(x), edge(y), edge(x + 1) - edge(x), edge(y + 1) - edge(y));
  }
  var noise = tok("--boot-noise");
  function draw(reveal) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    var count = Math.round(on.length * reveal);
    for (var n = 0; n < count; n++) cell(on[n]);
    var sparkle = Math.round(cells * cells * noise * (1 - reveal) * (reduced ? 0 : 1));
    ctx.globalAlpha = 0.55;
    for (var m = 0; m < sparkle; m++) cell((Math.random() * cells * cells) | 0);
    ctx.globalAlpha = 1;
  }

  var tasks = [];
  function task(weight) {
    var t = { weight: weight || 1, loaded: 0, done: false };
    tasks.push(t);
    return t;
  }
  function progress() {
    var total = 0, got = 0;
    tasks.forEach(function (t) {
      total += t.weight;
      got += t.done ? t.weight : Math.min(t.loaded, t.weight);
    });
    return total ? got / total : 1;
  }

  function stream(url, expected) {
    var t = task(expected || 100000);
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      if (!res.body || !res.body.getReader) return res.blob();
      var reader = res.body.getReader();
      var chunks = [];
      var pump = function () {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks, { type: res.headers.get("content-type") || "" });
          chunks.push(r.value);
          t.loaded += r.value.byteLength;
          return pump();
        });
      };
      return pump();
    }).then(function (blob) {
      t.done = true;
      return blob;
    }, function (err) {
      t.done = true;
      throw err;
    });
  }

  var avif = cfg.avifProbe
    ? new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () { resolve(im.width > 0); };
        im.onerror = function () { resolve(false); };
        im.src = cfg.avifProbe;
      })
    : Promise.resolve(false);

  var wallTask = task(1);
  avif.then(function (ok) {
    var plan = window.__wallpaper && window.__wallpaper.plan(ok);
    if (!plan) { wallTask.done = true; return; }
    wallTask.weight = cfg.bytes[plan.url] || 150000;
    wallTask.done = true;
    tasks.splice(tasks.indexOf(wallTask), 1);
    stream(plan.url, cfg.bytes[plan.url]).then(function (blob) {
      window.__wallpaper.useBlob(URL.createObjectURL(blob), plan.v);
    }, function () {
      window.__wallpaper.apply();
    });
  });

  if (!root.hasAttribute("data-apple")) {
    stream(cfg.font.url, cfg.font.bytes).then(function (blob) {
      return blob.arrayBuffer();
    }).then(function (buf) {
      var face = new FontFace("Inter Variable", buf, { weight: "100 900", style: "normal", display: "swap", sizeAdjust: "97%" });
      return face.load().then(function (f) { document.fonts.add(f); });
    }).catch(function () {});
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('#desktop img[fetchpriority="high"]').forEach(function (img) {
      var t = task(cfg.imageBytes);
      if (img.complete) { t.done = true; return; }
      var end = function () { t.done = true; };
      img.addEventListener("load", end, { once: true });
      img.addEventListener("error", end, { once: true });
    });
  });

  var minMs = reduced ? 500 : tok("--boot-min-ms");
  var maxMs = tok("--boot-max-ms");
  var start = performance.now();
  var shown = 0;
  var frames = [];
  var last = start;
  var finishing = false;

  function finish(fast) {
    if (finishing) return;
    finishing = true;
    shown = 1;
    fill.style.transform = "scaleX(1)";
    draw(1);
    probeGlass();
    setTimeout(function () {
      fade(bootEl, fast ? 200 : tok("--boot-fade-ms"));
      setTimeout(function () { done("boot"); }, (fast ? 200 : tok("--boot-fade-ms")) * 0.5);
    }, fast ? 0 : tok("--boot-hold-ms"));
  }

  function probeGlass() {
    if (root.hasAttribute("data-glass-pinned") || frames.length < 20) return;
    try { if (localStorage.getItem("shell:glass")) return; } catch (e) {}
    var sorted = frames.slice().sort(function (a, b) { return a - b; });
    var median = sorted[sorted.length >> 1];
    var order = ["high", "medium", "low"];
    var tier = root.getAttribute("data-glass");
    var next = median > 34 ? "low" : median > 20 ? order[Math.min(order.indexOf(tier) + 1, 2)] : tier;
    if (next !== tier) {
      root.setAttribute("data-glass", next);
      try { localStorage.setItem("shell:glass", next); } catch (e) {}
    }
  }

  function frame(now) {
    if (finishing) return;
    frames.push(now - last);
    last = now;
    var elapsed = now - start;
    var real = progress();
    shown += (real - shown) * 0.18;
    if (real - shown < 0.002) shown = real;
    fill.style.transform = "scaleX(" + shown.toFixed(4) + ")";
    draw(reduced ? 1 : Math.min(shown, elapsed / minMs));
    if ((real >= 1 && elapsed >= minMs) || elapsed >= maxMs) return finish(false);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var skip = function () { finish(true); };
  bootEl.addEventListener("pointerdown", skip);
  addEventListener("keydown", function k() { removeEventListener("keydown", k, true); skip(); }, true);
})();

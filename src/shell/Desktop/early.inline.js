(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var brands = navigator.userAgentData && navigator.userAgentData.brands;
  var chromium = !!(brands && brands.some(function (b) { return b.brand === "Chromium"; }));
  var tier = chromium ? "high" : "medium";
  try {
    tier = localStorage.getItem("shell:glass") || tier;
  } catch (e) {}
  if (navigator.connection && navigator.connection.saveData) tier = "low";
  var forced = new URLSearchParams(location.search).get("glass");
  if (forced === "high" || forced === "medium" || forced === "low") {
    tier = forced;
    root.setAttribute("data-glass-pinned", "");
  }
  root.setAttribute("data-glass", tier);

  var params = new URLSearchParams(location.search);
  var seen = false;
  try {
    seen = !!localStorage.getItem("shell:booted");
  } catch (e) {}
  var mode = seen ? "lock" : "boot";
  if (params.get("boot") === "1") mode = "boot";
  if (params.get("lock") === "1") mode = "lock";
  if (params.get("boot") === "0") mode = "none";
  root.setAttribute("data-boot", mode);

  var apple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (navigator.userAgentData && navigator.userAgentData.platform === "macOS");
  root.toggleAttribute("data-apple", !!apple);
  if (!apple && mode !== "boot") {
    var link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.href = "/fonts/InterVariable.woff2";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
  function hairline() {
    var dpr = window.devicePixelRatio || 1;
    root.style.setProperty("--hairline", 1 / dpr + "px");
    root.style.setProperty("--dpr", dpr);
    matchMedia("(resolution: " + dpr + "dppx)").addEventListener("change", hairline, { once: true });
  }
  hairline();
})();

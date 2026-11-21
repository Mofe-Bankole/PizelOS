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
  function hairline() {
    var dpr = window.devicePixelRatio || 1;
    root.style.setProperty("--hairline", 1 / dpr + "px");
    root.style.setProperty("--dpr", dpr);
    matchMedia("(resolution: " + dpr + "dppx)").addEventListener("change", hairline, { once: true });
  }
  hairline();
})();

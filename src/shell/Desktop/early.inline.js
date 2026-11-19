(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var tier = "medium";
  try {
    tier = localStorage.getItem("shell:glass") || tier;
  } catch (e) {}
  if (navigator.connection && navigator.connection.saveData) tier = "low";
  root.setAttribute("data-glass", tier);
  function hairline() {
    var dpr = window.devicePixelRatio || 1;
    root.style.setProperty("--hairline", 1 / dpr + "px");
    root.style.setProperty("--dpr", dpr);
    matchMedia("(resolution: " + dpr + "dppx)").addEventListener("change", hairline, { once: true });
  }
  hairline();
})();

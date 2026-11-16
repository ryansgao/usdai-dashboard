/* Set the theme before first paint: saved choice, else the system setting. */
(function () {
  try {
    var saved = localStorage.getItem("usdai-theme");
    var dark = saved ? saved === "dark" : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {}
})();

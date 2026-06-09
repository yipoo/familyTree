(() => {
  try {
    var key = "zupu-theme";
    var cookieKey = "zupu-theme";
    var stored = null;
    try {
      stored = localStorage.getItem(key);
    } catch (_) {}
    if (!stored) {
      var match = document.cookie.match(
        new RegExp("(?:^|; )" + cookieKey + "=([^;]+)"),
      );
      if (match) stored = decodeURIComponent(match[1]);
    }
    var t =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    var resolved =
      t === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
    var html = document.documentElement;
    html.classList.toggle("dark", resolved === "dark");
    html.style.colorScheme = resolved;
    html.setAttribute("data-theme", t);
    html.setAttribute("data-resolved-theme", resolved);
  } catch (_) {}
})();

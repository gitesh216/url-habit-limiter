// content.js
// Two jobs only:
//  1) Notice URL changes that Manifest V3's tabs.onUpdated can miss - SPA
//     pushState/replaceState navigation (YouTube, Reddit, X, Instagram all
//     do this instead of a full page load when you tap the next item).
//  2) Render an unobtrusive in-page warning toast when told to by background.js.

(function () {
    let lastReportedUrl = null;

    function reportUrlChange() {
        const url = location.href;
        if (url === lastReportedUrl) return;
        lastReportedUrl = url;
        chrome.runtime
            .sendMessage({ type: "UHL_URL_CHANGED", url })
            .catch(() => {});
    }

    // Patch pushState/replaceState — the mechanism every major SPA uses for
    // "next video" / "next post" navigation without a real page load.
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        const result = originalPushState.apply(this, args);
        reportUrlChange();
        return result;
    };

    history.replaceState = function (...args) {
        const result = originalReplaceState.apply(this, args);
        reportUrlChange();
        return result;
    };

    window.addEventListener("popstate", reportUrlChange);
    window.addEventListener("hashchange", reportUrlChange);

    // Initial load.
    reportUrlChange();

    // Some SPAs update the DOM (and effectively "navigate") without ever
    // touching the history API (e.g. an infinite-scroll feed). As a safety
    // net, poll lightly - cheap enough not to matter, cheap being the point.
    setInterval(reportUrlChange, 2000);

    // --- Warning toast ---
    function showWarningToast({ ruleName, count, limit, remaining }) {
        const hostId = "uhl-warning-toast-host";
        document.getElementById(hostId)?.remove();

        const host = document.createElement("div");
        host.id = hostId;
        host.style.all = "initial";
        host.style.position = "fixed";
        host.style.top = "16px";
        host.style.right = "16px";
        host.style.zIndex = "2147483647";
        document.documentElement.appendChild(host);

        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `
      <style>
        .toast {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          background: #1C1E1B;
          color: #FAFAF8;
          border-left: 4px solid #C97A2B;
          border-radius: 10px;
          padding: 14px 16px;
          min-width: 260px;
          max-width: 320px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          animation: uhl-slide-in 0.25s ease-out;
        }
        @keyframes uhl-slide-in {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .title { font-weight: 600; font-size: 13px; letter-spacing: 0.02em; text-transform: uppercase; color: #C97A2B; margin: 0 0 6px; }
        .body { font-size: 14px; line-height: 1.4; margin: 0 0 10px; }
        .bar-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.15); overflow: hidden; }
        .bar-fill { height: 100%; background: #C97A2B; border-radius: 999px; }
        .close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: #9A968C; font-size: 16px; cursor: pointer; line-height: 1; }
        .wrap { position: relative; }
      </style>
      <div class="toast">
        <div class="wrap">
          <button class="close" aria-label="Dismiss">&times;</button>
          <p class="title">Approaching your limit</p>
          <p class="body"><strong>${ruleName}</strong>: ${count} of ${limit} visits today. ${remaining} left before this gets blocked.</p>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, (count / limit) * 100)}%"></div></div>
        </div>
      </div>
    `;
        shadow
            .querySelector(".close")
            .addEventListener("click", () => host.remove());
        setTimeout(() => host.remove(), 6000);
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === "UHL_SHOW_WARNING") {
            showWarningToast(message);
        }
    });
})();

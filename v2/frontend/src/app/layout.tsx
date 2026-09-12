import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CareerMate", template: "%s · CareerMate" },
  description: "Nền tảng phát triển năng lực và lộ trình nghề nghiệp đáng tin cậy.",
};

const extensionProtectionScript = `
(function() {
  if (typeof window === "undefined") return;

  var extensionPattern = /(chrome-extension:\\/\\/|moz-extension:\\/\\/|safari-web-extension:\\/\\/|executors\\/200\\.js|M_ID|bis_skin_checked|bis_register|__processed_|cz-shortcut-listen|mdl-js|eppiocemhmnlbhjplcgkofciiegomcon|runtime\\.lastError|Could not establish connection|data-gr-ext|data-new-gr|data-lastpass|data-1p|data-bitwarden|data-dashlane)/;

  function isIgnored(arg) {
    if (!arg) return false;
    var str = typeof arg === "string" ? arg : (arg && (arg.message || arg.stack) ? (arg.message || arg.stack) : String(arg || ""));
    if (extensionPattern.test(str)) return true;
    if (str.indexOf("A tree hydrated but some attributes") !== -1 || str.indexOf("hydration-mismatch") !== -1) return true;
    return false;
  }

  function shouldIgnore(args) {
    for (var i = 0; i < args.length; i++) {
      if (isIgnored(args[i])) return true;
    }
    return false;
  }

  // Intercept uncaught errors from browser extensions in capture phase
  window.addEventListener(
    "error",
    function(event) {
      var source = (event.filename || "") + " " + (event.message || "") + " " + (event.error && event.error.stack ? event.error.stack : "");
      if (shouldIgnore([source])) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  // Intercept unhandled promise rejections from browser extensions in capture phase
  window.addEventListener(
    "unhandledrejection",
    function(event) {
      var reason = event.reason;
      var source = (reason && reason.stack ? reason.stack : "") + " " + (reason && reason.message ? reason.message : "") + " " + String(reason || "");
      if (shouldIgnore([source])) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  // Hook console.error with recursion guard so Next.js dev overlay cannot crash or open on extension errors
  var nativeError = console.error.bind(console);
  var devOverlayHandler = null;
  var inDevOverlay = false;

  try {
    Object.defineProperty(console, "error", {
      configurable: true,
      enumerable: true,
      get: function() {
        return function() {
          if (shouldIgnore(arguments)) return;
          if (devOverlayHandler && !inDevOverlay) {
            try {
              inDevOverlay = true;
              return devOverlayHandler.apply(this, arguments);
            } finally {
              inDevOverlay = false;
            }
          }
          return nativeError.apply(this, arguments);
        };
      },
      set: function(fn) {
        devOverlayHandler = fn;
      }
    });
  } catch (e) {
    var fallbackError = console.error;
    console.error = function() {
      if (shouldIgnore(arguments)) return;
      return fallbackError.apply(this, arguments);
    };
  }

  // Hook console.warn similarly
  var nativeWarn = console.warn.bind(console);
  var devOverlayWarnHandler = null;
  var inDevOverlayWarn = false;

  try {
    Object.defineProperty(console, "warn", {
      configurable: true,
      enumerable: true,
      get: function() {
        return function() {
          if (shouldIgnore(arguments)) return;
          if (devOverlayWarnHandler && !inDevOverlayWarn) {
            try {
              inDevOverlayWarn = true;
              return devOverlayWarnHandler.apply(this, arguments);
            } finally {
              inDevOverlayWarn = false;
            }
          }
          return nativeWarn.apply(this, arguments);
        };
      },
      set: function(fn) {
        devOverlayWarnHandler = fn;
      }
    });
  } catch (e) {
    var fallbackWarn = console.warn;
    console.warn = function() {
      if (shouldIgnore(arguments)) return;
      return fallbackWarn.apply(this, arguments);
    };
  }

  // Clean DOM attributes injected by extensions (bis_*, __processed_*, cz-*, etc.)
  var attrPattern = /^(bis_|__processed_|cz-|data-gr-|data-new-gr-|data-lastpass|data-1p|data-bw)/;
  function clean(node) {
    if (!node || node.nodeType !== 1) return;
    var attrs = node.attributes;
    if (attrs) {
      for (var i = attrs.length - 1; i >= 0; i--) {
        var name = attrs[i].name;
        if (attrPattern.test(name)) node.removeAttribute(name);
      }
    }
    if (node.classList && node.classList.contains("mdl-js")) {
      node.classList.remove("mdl-js");
    }
  }

  if (typeof document !== "undefined") {
    if (document.documentElement) clean(document.documentElement);
    if (document.body) clean(document.body);
  }

  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.documentElement) {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes") {
          if (m.attributeName && attrPattern.test(m.attributeName)) {
            m.target.removeAttribute(m.attributeName);
          }
          if (m.attributeName === "class" && m.target && m.target.classList && m.target.classList.contains("mdl-js")) {
            m.target.classList.remove("mdl-js");
          }
        } else if (m.type === "childList") {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1) {
              clean(n);
              var ch = n.querySelectorAll ? n.querySelectorAll("*") : [];
              for (var k = 0; k < ch.length; k++) clean(ch[k]);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, subtree: true, childList: true });
  }

  if (typeof Element !== "undefined") {
    var origSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, val) {
      if (attrPattern.test(name)) return;
      if (name === "class" && typeof val === "string" && val.indexOf("mdl-js") !== -1) {
        val = val.replace(/\\bmdl-js\\b/g, "").trim();
      }
      return origSet.apply(this, arguments);
    };
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta name="careermate-build-sha" content={process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown"} />
        <script dangerouslySetInnerHTML={{ __html: extensionProtectionScript }} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0">
          Bỏ qua đến nội dung chính
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

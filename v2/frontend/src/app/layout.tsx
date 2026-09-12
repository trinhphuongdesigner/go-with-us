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
  if (typeof window === 'undefined') return;

  var extensionPattern = /(chrome-extension:\\/\\/|moz-extension:\\/\\/|safari-web-extension:\\/\\/|executors\\/200\\.js|M_ID|bis_skin_checked|bis_register|__processed_)/;

  function isExtensionError(source) {
    if (!source) return false;
    if (typeof source !== 'string') {
      try {
        source = (source.stack || source.message || String(source));
      } catch (e) {
        return false;
      }
    }
    return extensionPattern.test(source);
  }

  // Intercept uncaught errors from browser extensions in capture phase
  window.addEventListener(
    'error',
    function(event) {
      var source = (event.filename || '') + ' ' + (event.message || '') + ' ' + (event.error && event.error.stack ? event.error.stack : '');
      if (isExtensionError(source)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  // Intercept unhandled promise rejections from browser extensions in capture phase
  window.addEventListener(
    'unhandledrejection',
    function(event) {
      var reason = event.reason;
      var source = (reason && reason.stack ? reason.stack : '') + ' ' + (reason && reason.message ? reason.message : '') + ' ' + String(reason || '');
      if (isExtensionError(source)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  // Hook console.error with getter/setter so Next.js dev overlay cannot bypass it
  var currentConsoleError = console.error;
  try {
    Object.defineProperty(console, 'error', {
      configurable: true,
      enumerable: true,
      get: function() {
        return function() {
          for (var i = 0; i < arguments.length; i++) {
            if (isExtensionError(arguments[i])) {
              return;
            }
          }
          return currentConsoleError.apply(this, arguments);
        };
      },
      set: function(fn) {
        currentConsoleError = fn;
      }
    });
  } catch (e) {
    console.error = function() {
      for (var i = 0; i < arguments.length; i++) {
        if (isExtensionError(arguments[i])) return;
      }
      return currentConsoleError.apply(this, arguments);
    };
  }

  // Clean DOM attributes injected by extensions (bis_*, __processed_*)
  var attrPattern = /^(bis_|__processed_)/;
  function clean(node) {
    if (!node || node.nodeType !== 1) return;
    var attrs = node.attributes;
    for (var i = attrs.length - 1; i >= 0; i--) {
      var name = attrs[i].name;
      if (attrPattern.test(name)) node.removeAttribute(name);
    }
  }

  if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes') {
          if (m.attributeName && attrPattern.test(m.attributeName)) {
            m.target.removeAttribute(m.attributeName);
          }
        } else if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1) {
              clean(n);
              var ch = n.querySelectorAll ? n.querySelectorAll('*') : [];
              for (var k = 0; k < ch.length; k++) clean(ch[k]);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, subtree: true, childList: true });
  }

  if (typeof Element !== 'undefined') {
    var origSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, val) {
      if (attrPattern.test(name)) return;
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

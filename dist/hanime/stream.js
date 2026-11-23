"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStream = void 0;

const DEFAULT_BASE_URL = "https://hanime.tv";

async function resolveBaseUrl(providerContext) {
  try {
    const override = await providerContext.kvStore?.get("baseUrlOverride");
    if (override && override.trim().length > 0) {
      return override.trim().replace(/\/+$/, "");
    }
  } catch (e) {}
  return DEFAULT_BASE_URL;
}

function extractSlug(link) {
  try {
    const clean = link.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

exports.getStream = async function ({
  link,
  type,
  signal,
  providerContext,
  isDownload,
}) {
  const streams = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);

    if (/\.(m3u8|mpd|mp4|mkv)(\?.*)?$/i.test(link)) {
      const streamType = link.includes(".m3u8")
        ? "m3u8"
        : link.includes(".mpd")
        ? "mpd"
        : "mp4";
      return [
        {
          server: "Direct Stream",
          link,
          type: streamType,
          headers: {
            Referer: `${baseUrl}/`,
            Origin: baseUrl,
          },
        },
      ];
    }

    const slug = extractSlug(link);
    const watchUrl = link.startsWith("http")
      ? link
      : `${baseUrl}/videos/hentai/${slug}`;

    if (providerContext.openWebView) {
      const injectedCode = `
        (function() {
          var sent = false;
          function send(data) {
            if (sent || !data) return;
            sent = true;
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  __waf: true,
                  data: data
                }));
              }
            } catch(e) {}
          }

          function b64d(str) {
            var p = str.replace(/-/g, '+').replace(/_/g, '/');
            while (p.length % 4) p += '=';
            var b = atob(p);
            var arr = new Uint8Array(b.length);
            for (var i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
            return arr;
          }

          async function decryptToken(token) {
            try {
              var s = "htv-insecure-handshake-v1";
              var c = "htv-insecure-v1";
              var rawKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
              var key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
              var envJson = new TextDecoder().decode(b64d(token));
              var env = JSON.parse(envJson);
              var iv = b64d(env.iv);
              var data = b64d(env.data);
              var tag = b64d(env.tag);
              var combined = new Uint8Array(data.length + tag.length);
              combined.set(data, 0);
              combined.set(tag, data.length);
              var dec = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv, additionalData: new TextEncoder().encode(c), tagLength: 128 },
                key,
                combined
              );
              var result = JSON.parse(new TextDecoder().decode(dec));
              if (result && Array.isArray(result.sources) && result.sources.length > 0) {
                send(result.sources);
              }
            } catch (e) {
              console.error("[Hanime Provider] Token decrypt error:", e);
            }
          }

          var origFetch = window.fetch;
          window.fetch = async function() {
            var res = await origFetch.apply(this, arguments);
            try {
              var url = arguments[0] ? (typeof arguments[0] === 'string' ? arguments[0] : arguments[0].url) : '';
              if (url && url.indexOf('/handshake') !== -1) {
                var xToken = res.headers.get('x-token');
                if (xToken) {
                  decryptToken(xToken);
                }
              }
            } catch(e) {}
            return res;
          };

          function poll() {
            if (sent) return;
            try {
              if (window.videojs && window.videojs.players) {
                for (var k in window.videojs.players) {
                  var p = window.videojs.players[k];
                  if (p && typeof p.currentSources === 'function') {
                    var s = p.currentSources();
                    if (s && s.length) { send(s); return; }
                  }
                  if (p && typeof p.src === 'function') {
                    var src = p.src();
                    if (src) { send([{ src: src }]); return; }
                  }
                }
              }
              var v = document.querySelector('video');
              if (v && v.src && v.src.indexOf('blob:') === -1) {
                send([{ src: v.src }]);
                return;
              }
            } catch(e) {}
          }

          var timer = setInterval(poll, 400);
          setTimeout(function() { clearInterval(timer); }, 25000);
        })();
        true;
      `;

      const result = await providerContext.openWebView(watchUrl, {
        title: "Loading Hanime Stream...",
        timeoutMs: 30000,
        injectedJavaScript: injectedCode,
      });

      const sources = result?.data;
      if (Array.isArray(sources) && sources.length > 0) {
        for (const item of sources) {
          const streamUrl = item?.src || item?.url || item?.link;
          if (!streamUrl) continue;
          const label =
            item?.label || (item?.height ? `${item.height}p` : "Auto");
          const streamType = streamUrl.includes(".m3u8")
            ? "m3u8"
            : streamUrl.includes(".mpd")
            ? "mpd"
            : "mp4";
          streams.push({
            server: `Hanime CDN (${label})`,
            link: streamUrl,
            type: streamType,
            quality: label.replace(/[^0-9]/g, "") || undefined,
            headers: {
              Referer: `${baseUrl}/`,
              Origin: baseUrl,
            },
          });
        }
      }
    }

    streams.sort((a, b) => {
      const aIsDownload = a.type === "mp4" || a.type === "mkv";
      const bIsDownload = b.type === "mp4" || b.type === "mkv";
      if (isDownload) {
        if (aIsDownload !== bIsDownload)
          return Number(bIsDownload) - Number(aIsDownload);
      } else {
        if (aIsDownload !== bIsDownload)
          return Number(!bIsDownload) - Number(!aIsDownload);
      }
      const aRes = parseInt(String(a.quality || "0"), 10) || 0;
      const bRes = parseInt(String(b.quality || "0"), 10) || 0;
      return bRes - aRes;
    });
  } catch (err) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error("[hanime] getStream error:", err.message || err);
  }
  return streams;
};

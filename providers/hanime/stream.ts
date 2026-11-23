import { ProviderContext, Stream } from "../types";

const DEFAULT_BASE_URL = "https://hanime.tv";

async function resolveBaseUrl(providerContext: ProviderContext): Promise<string> {
  try {
    const override = await providerContext.kvStore?.get<string>("baseUrlOverride");
    if (override && override.trim().length > 0) {
      return override.trim().replace(/\/+$/, "");
    }
  } catch (e) {}
  if (providerContext.getBaseUrl) {
    try {
      const url = await providerContext.getBaseUrl();
      if (url) return url.replace(/\/+$/, "");
    } catch (e) {}
  }
  return DEFAULT_BASE_URL;
}

function extractSlug(link: string): string {
  try {
    const clean = link.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

export const getStream = async function ({
  link,
  type,
  signal,
  providerContext,
  isDownload,
}: {
  link: string;
  type?: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const streams: Stream[] = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);

    // If direct media link is passed directly
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

          function u(buf) {
            var bin = '';
            var bytes = new Uint8Array(buf);
            for (var i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
          }

          async function tryHandshake() {
            if (sent) return;
            try {
              if (typeof window.Emit === 'function') {
                window.Emit('e');
              } else {
                window.dispatchEvent(new CustomEvent('e'));
              }

              var sig = window.ssignature;
              var time = window.stime;
              if (!sig || !time) return;

              var csrf = (window.S && window.S.csrf_token) || '';
              if (!csrf) {
                try {
                  var cr = await fetch('https://ct.hanime.tv/csrf-token');
                  var cd = await cr.json();
                  csrf = cd.csrf_token;
                } catch(e) {}
              }

              var parts = window.location.pathname.split('/').filter(Boolean);
              var pageSlug = parts[parts.length - 1] || '';
              if (!pageSlug) return;

              var s = 'htv-insecure-handshake-v1';
              var c = 'htv-insecure-v1';

              var rawKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
              var encKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
              var iv = crypto.getRandomValues(new Uint8Array(12));
              var payloadStr = JSON.stringify({
                timestamp_unix: Math.floor(Date.now() / 1000),
                directive: 'htv_player_handshake',
                slug: pageSlug
              });
              var enc = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv, additionalData: new TextEncoder().encode(c), tagLength: 128 },
                encKey,
                new TextEncoder().encode(payloadStr)
              );
              var encBytes = new Uint8Array(enc);
              var dataBytes = encBytes.slice(0, -16);
              var tagBytes = encBytes.slice(-16);
              var env = { v: 1, alg: 'AES-256-GCM', iv: u(iv), tag: u(tagBytes), data: u(dataBytes) };
              var token = u(new TextEncoder().encode(JSON.stringify(env)));

              var res = await fetch('https://auth.hanime.tv/api/v11/handshake', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'accept': 'application/json',
                  'x-signature-version': 'web2',
                  'x-signature': sig,
                  'x-time': String(time),
                  'x-csrf-token': csrf
                },
                body: JSON.stringify({ token: token, csrf_token: csrf })
              });

              var xToken = res.headers.get('x-token');
              if (!xToken) return;

              var decKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
              var parsedEnv = JSON.parse(new TextDecoder().decode(b64d(xToken)));
              var dIv = b64d(parsedEnv.iv);
              var dData = b64d(parsedEnv.data);
              var dTag = b64d(parsedEnv.tag);
              var combined = new Uint8Array(dData.length + dTag.length);
              combined.set(dData, 0);
              combined.set(dTag, dData.length);
              var dec = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: dIv, additionalData: new TextEncoder().encode(c), tagLength: 128 },
                decKey,
                combined
              );
              var data = JSON.parse(new TextDecoder().decode(dec));

              var sources = (data && data.sources) || [];
              var extracted = [];
              for (var i = 0; i < sources.length; i++) {
                var item = sources[i];
                if (item && item.src && item.src.length > 0) {
                  var hlsUrl = item.src.startsWith('http') ? item.src : 'https://hanime.tv' + item.src;
                  var qLabel = item.label || (item.height ? item.height + 'p' : '720p');
                  extracted.push({
                    server: 'Hanime CDN (' + qLabel + ')',
                    link: hlsUrl,
                    type: 'm3u8',
                    quality: String(item.height || item.label || '720').replace(/[^0-9]/g, ''),
                    headers: {
                      'Referer': 'https://hanime.tv/',
                      'Origin': 'https://hanime.tv'
                    }
                  });
                }
              }
              if (extracted.length > 0) {
                send(extracted);
              }
            } catch(e) {}
          }

          // Trigger immediately
          tryHandshake();

          // Poll up to 25 times every 400ms
          var pollCount = 0;
          var pollTimer = setInterval(function() {
            pollCount++;
            if (sent || pollCount > 25) {
              clearInterval(pollTimer);
              return;
            }
            tryHandshake();
          }, 400);

          // Hook fetch in case the player calls handshake
          var origFetch = window.fetch;
          window.fetch = async function() {
            var res = await origFetch.apply(this, arguments);
            try {
              var url = arguments[0] ? (typeof arguments[0] === 'string' ? arguments[0] : arguments[0].url) : '';
              if (url && url.indexOf('/handshake') !== -1) {
                var xToken = res.headers.get('x-token');
                if (xToken) {
                  tryHandshake();
                }
              }
            } catch(e) {}
            return res;
          };
        })();
        true;
      `;

      const result = await providerContext.openWebView(watchUrl, {
        title: "Loading Hanime Stream...",
        timeoutMs: 45000,
        injectedJavaScript: injectedCode,
      });

      const data = result?.data;
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          if (item?.link && item?.server) {
            streams.push(item);
          } else if (item?.src) {
            const hlsUrl = item.src.startsWith("http")
              ? item.src
              : `${baseUrl}${item.src}`;
            const label = item.label || (item.height ? `${item.height}p` : "720p");
            streams.push({
              server: `Hanime CDN (${label})`,
              link: hlsUrl,
              type: "m3u8",
              quality: String(item.height || item.label || "720").replace(/[^0-9]/g, ""),
              headers: {
                Referer: `${baseUrl}/`,
                Origin: baseUrl,
              },
            });
          }
        }
      }

      // Fallback: check rendered HTML in response for /hls/ paths if data was empty
      if (streams.length === 0 && result?.response) {
        const hlsMatches = result.response.match(/\/hls\/\d+\/[a-zA-Z0-9_\-]+/g);
        if (hlsMatches) {
          const uniqueHls = Array.from(new Set(hlsMatches));
          for (const [idx, hlsPath] of uniqueHls.entries()) {
            streams.push({
              server: `Hanime Stream ${idx + 1}`,
              link: `${baseUrl}${hlsPath}`,
              type: "m3u8",
              quality: "720",
              headers: {
                Referer: `${baseUrl}/`,
                Origin: baseUrl,
              },
            });
          }
        }
      }
    }

    // Sort according to isDownload
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
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error("[hanime] getStream error:", err.message || err);
  }
  return streams;
};

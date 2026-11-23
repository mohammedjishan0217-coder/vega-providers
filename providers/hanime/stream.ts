import { ProviderContext, Stream } from "../types";

const DEFAULT_BASE_URL = "https://hanime.tv";
const INSECURE_SECRET = "htv-insecure-handshake-v1";
const INSECURE_AAD = "htv-insecure-v1";

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

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === "function") {
    return btoa(bin)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  return Buffer.from(bin, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  let p = str.replace(/-/g, "+").replace(/_/g, "/");
  while (p.length % 4) p += "=";
  if (typeof atob === "function") {
    const bin = atob(p);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const bin = Buffer.from(p, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sha256Hex(str: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  try {
    const nodeCrypto = require("crypto");
    return nodeCrypto.createHash("sha256").update(str).digest("hex");
  } catch {}
  throw new Error("SHA-256 not available in runtime");
}

async function encryptPayload(
  payloadStr: string,
  keyStr: string,
  aadStr: string
): Promise<{ iv: string; tag: string; data: string }> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const rawKey = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(keyStr)
    );
    const encKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const enc = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(aadStr),
        tagLength: 128,
      },
      encKey,
      new TextEncoder().encode(payloadStr)
    );
    const encBytes = new Uint8Array(enc);
    const dataBytes = encBytes.slice(0, -16);
    const tagBytes = encBytes.slice(-16);
    return {
      iv: toBase64Url(iv),
      tag: toBase64Url(tagBytes),
      data: toBase64Url(dataBytes),
    };
  }
  try {
    const nodeCrypto = require("crypto");
    const key = nodeCrypto.createHash("sha256").update(keyStr).digest();
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(aadStr));
    const data = Buffer.concat([
      cipher.update(payloadStr, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      iv: toBase64Url(iv),
      tag: toBase64Url(tag),
      data: toBase64Url(data),
    };
  } catch {}
  throw new Error("AES-GCM encryption not supported");
}

async function decryptToken(
  xToken: string,
  keyStr: string,
  aadStr: string
): Promise<any> {
  const parsedEnv = JSON.parse(
    new TextDecoder().decode(fromBase64Url(xToken))
  );
  const iv = fromBase64Url(parsedEnv.iv);
  const data = fromBase64Url(parsedEnv.data);
  const tag = fromBase64Url(parsedEnv.tag);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const rawKey = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(keyStr)
    );
    const decKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const combined = new Uint8Array(data.length + tag.length);
    combined.set(data, 0);
    combined.set(tag, data.length);
    const dec = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(aadStr),
        tagLength: 128,
      },
      decKey,
      combined
    );
    return JSON.parse(new TextDecoder().decode(dec));
  }
  try {
    const nodeCrypto = require("crypto");
    const rawKey = nodeCrypto.createHash("sha256").update(keyStr).digest();
    const decipher = nodeCrypto.createDecipheriv(
      "aes-256-gcm",
      rawKey,
      Buffer.from(iv)
    );
    decipher.setAAD(Buffer.from(aadStr));
    decipher.setAuthTag(Buffer.from(tag));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(data)),
      decipher.final(),
    ]);
    return JSON.parse(dec.toString("utf8"));
  } catch {}
  throw new Error("AES-GCM decryption not supported");
}

async function executeDirectHandshake(
  baseUrl: string,
  slug: string,
  providerContext: ProviderContext,
  signal?: AbortSignal
): Promise<Stream[]> {
  const time = Math.floor(Date.now() / 1000);
  const origin = baseUrl;
  const sigRaw = `${time},Xkdi29,${origin},mn2,${time}`;
  const sig = await sha256Hex(sigRaw);

  // 1. Fetch CSRF token
  const csrfRes = await providerContext.axios.get("https://ct.hanime.tv/csrf-token", {
    headers: {
      ...providerContext.commonHeaders,
      Referer: `${baseUrl}/`,
      Origin: origin,
    },
    signal,
  });
  const csrf = csrfRes.data?.csrf_token;
  if (!csrf) throw new Error("Could not acquire csrf_token");

  // 2. Encrypt token payload
  const payload = {
    timestamp_unix: time,
    directive: "htv_player_handshake",
    slug,
  };
  const env = await encryptPayload(
    JSON.stringify(payload),
    INSECURE_SECRET,
    INSECURE_AAD
  );
  const token = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ v: 1, alg: "AES-256-GCM", ...env }))
  );

  // 3. Post handshake
  const hsRes = await providerContext.axios.post(
    "https://auth.hanime.tv/api/v11/handshake",
    {
      token,
      csrf_token: csrf,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          providerContext.commonHeaders?.["User-Agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: origin,
        Referer: `${baseUrl}/videos/hentai/${slug}`,
        "x-signature-version": "web2",
        "x-signature": sig,
        "x-time": String(time),
        "x-csrf-token": csrf,
      },
      signal,
    }
  );

  const xToken =
    hsRes.headers?.["x-token"] ||
    (typeof hsRes.headers?.get === "function" ? hsRes.headers.get("x-token") : undefined);

  if (!xToken) {
    throw new Error(`Handshake failed with status: ${hsRes.status}`);
  }

  // 4. Decrypt sources
  const data = await decryptToken(xToken, INSECURE_SECRET, INSECURE_AAD);
  const sources = (data && data.sources) || [];
  const streams: Stream[] = [];

  for (const item of sources) {
    if (!item || !item.src || item.src.length === 0) continue;
    const hlsUrl = item.src.startsWith("http") ? item.src : `${baseUrl}${item.src}`;
    const qLabel = item.label || (item.height ? `${item.height}p` : "720p");
    streams.push({
      server: `Hanime CDN (${qLabel})`,
      link: hlsUrl,
      type: "m3u8",
      quality: qLabel,
      headers: {
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
      },
    });
  }

  return streams;
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

    // Direct stream link passed directly
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
    if (!slug) return [];

    // Attempt 1: Direct programmatic handshake (fast, no popups, no timeouts)
    try {
      const directStreams = await executeDirectHandshake(
        baseUrl,
        slug,
        providerContext,
        signal
      );
      if (directStreams && directStreams.length > 0) {
        if (isDownload) {
          directStreams.sort((a, b) => {
            const qA = parseInt(String(a.quality || "0").replace(/[^0-9]/g, ""), 10) || 0;
            const qB = parseInt(String(b.quality || "0").replace(/[^0-9]/g, ""), 10) || 0;
            return qB - qA;
          });
        }
        return directStreams;
      }
    } catch (directErr: any) {
      console.warn("[hanime] Direct handshake attempt failed, falling back to webview if available:", directErr.message || directErr);
    }

    // Attempt 2: Fallback to openWebView only if direct attempt failed and webview is available
    if (providerContext.openWebView) {
      const watchUrl = link.startsWith("http")
        ? link
        : `${baseUrl}/videos/hentai/${slug}`;

      const injectedCode = `
        (async function() {
          try {
            var time = Math.floor(Date.now() / 1000);
            var origin = "${baseUrl}";
            var sigRaw = time + ",Xkdi29," + origin + ",mn2," + time;
            var sigBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sigRaw));
            var sig = Array.from(new Uint8Array(sigBuf)).map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");

            var csrfRes = await fetch("https://ct.hanime.tv/csrf-token");
            var csrfJson = await csrfRes.json();
            var csrf = csrfJson.csrf_token;

            var s = "${INSECURE_SECRET}";
            var c = "${INSECURE_AAD}";

            function u(buf) {
              var bin = "";
              var bytes = new Uint8Array(buf);
              for (var i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
              return btoa(bin).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
            }

            function b64d(str) {
              var p = str.replace(/-/g, "+").replace(/_/g, "/");
              while (p.length % 4) p += "=";
              var b = atob(p);
              var arr = new Uint8Array(b.length);
              for (var i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
              return arr;
            }

            var rawKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
            var encKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
            var iv = crypto.getRandomValues(new Uint8Array(12));
            var payload = JSON.stringify({ timestamp_unix: time, directive: "htv_player_handshake", slug: "${slug}" });
            var enc = await crypto.subtle.encrypt(
              { name: "AES-GCM", iv: iv, additionalData: new TextEncoder().encode(c), tagLength: 128 },
              encKey,
              new TextEncoder().encode(payload)
            );
            var encBytes = new Uint8Array(enc);
            var env = { v: 1, alg: "AES-256-GCM", iv: u(iv), tag: u(encBytes.slice(-16)), data: u(encBytes.slice(0, -16)) };
            var token = u(new TextEncoder().encode(JSON.stringify(env)));

            var hsRes = await fetch("https://auth.hanime.tv/api/v11/handshake", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "accept": "application/json",
                "x-signature-version": "web2",
                "x-signature": sig,
                "x-time": String(time),
                "x-csrf-token": csrf
              },
              body: JSON.stringify({ token: token, csrf_token: csrf })
            });

            var xToken = hsRes.headers.get("x-token");
            if (xToken) {
              var decKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
              var parsedEnv = JSON.parse(new TextDecoder().decode(b64d(xToken)));
              var dIv = b64d(parsedEnv.iv);
              var dData = b64d(parsedEnv.data);
              var dTag = b64d(parsedEnv.tag);
              var combined = new Uint8Array(dData.length + dTag.length);
              combined.set(dData, 0);
              combined.set(dTag, dData.length);
              var dec = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: dIv, additionalData: new TextEncoder().encode(c), tagLength: 128 },
                decKey,
                combined
              );
              var data = JSON.parse(new TextDecoder().decode(dec));
              var sources = (data && data.sources) || [];
              var extracted = [];
              for (var i = 0; i < sources.length; i++) {
                var item = sources[i];
                if (item && item.src && item.src.length > 0) {
                  var hlsUrl = item.src.startsWith("http") ? item.src : "${baseUrl}" + item.src;
                  var qLabel = item.label || (item.height ? item.height + "p" : "720p");
                  extracted.push({
                    server: "Hanime CDN (" + qLabel + ")",
                    link: hlsUrl,
                    type: "m3u8",
                    quality: qLabel,
                    headers: {
                      "Referer": "${baseUrl}/",
                      "Origin": "${baseUrl}"
                    }
                  });
                }
              }
              if (extracted.length > 0 && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ __waf: true, data: extracted }));
              }
            }
          } catch(e) {}
        })();
        true;
      `;

      const result = await providerContext.openWebView(watchUrl, {
        title: "Loading Hanime Stream...",
        timeoutMs: 30000,
        injectedJavaScript: injectedCode,
      });

      let data = result?.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {}
      }

      if (Array.isArray(data) && data.length > 0) {
        for (const s of data) {
          if (s && s.link) {
            streams.push(s);
          }
        }
      }
    }

    if (isDownload && streams.length > 0) {
      streams.sort((a, b) => {
        const qA = parseInt(String(a.quality || "0").replace(/[^0-9]/g, ""), 10) || 0;
        const qB = parseInt(String(b.quality || "0").replace(/[^0-9]/g, ""), 10) || 0;
        return qB - qA;
      });
    }

    return streams;
  } catch (err: any) {
    console.error("[hanime] getStream fatal error:", err.message || err);
    return [];
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStream = void 0;

exports.getStream = async function ({
  link,
  type,
  signal,
  providerContext,
  isDownload,
}) {
  const streams = [];
  try {
    const res = await providerContext.axios.get(link, {
      headers: {
        ...providerContext.commonHeaders,
        Referer: link,
      },
      signal,
    });

    const html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

    const m3u8Matches = html.match(/https?:\/\/[^"'\\s\s]+\.m3u8[^"'\\s\s]*/g) || [];
    for (const rawUrl of Array.from(new Set(m3u8Matches))) {
      const cleanUrl = rawUrl.replace(/\\/g, "");
      let quality;
      if (cleanUrl.includes("1080p")) quality = "1080";
      else if (cleanUrl.includes("720p")) quality = "720";
      else if (cleanUrl.includes("480p")) quality = "480";
      else if (cleanUrl.includes("240p")) quality = "240";

      streams.push({
        server: `xHamster HLS ${quality ? `(${quality}p)` : "(Auto)"}`.trim(),
        link: cleanUrl,
        type: "m3u8",
        quality,
        headers: {
          Referer: link,
          Origin: new URL(link).origin,
          "User-Agent":
            providerContext.commonHeaders["User-Agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }

    const mp4Matches = html.match(/https?:\/\/[^"'\\s\s]+\.mp4[^"'\\s\s]*/g) || [];
    for (const rawUrl of Array.from(new Set(mp4Matches))) {
      if (rawUrl.includes(".m3u8")) continue;
      const cleanUrl = rawUrl.replace(/\\/g, "");
      let quality;
      if (cleanUrl.includes("1080p") || cleanUrl.includes("1080")) quality = "1080";
      else if (cleanUrl.includes("720p") || cleanUrl.includes("720")) quality = "720";
      else if (cleanUrl.includes("480p") || cleanUrl.includes("480")) quality = "480";

      streams.push({
        server: `xHamster Direct MP4 ${quality ? `(${quality}p)` : ""}`.trim(),
        link: cleanUrl,
        type: "mp4",
        quality,
        headers: {
          Referer: link,
          Origin: new URL(link).origin,
          "User-Agent":
            providerContext.commonHeaders["User-Agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }

    streams.sort((a, b) => {
      const aIsMp4 = a.type === "mp4";
      const bIsMp4 = b.type === "mp4";
      if (isDownload) {
        return aIsMp4 === bIsMp4 ? 0 : aIsMp4 ? -1 : 1;
      } else {
        return aIsMp4 === bIsMp4 ? 0 : aIsMp4 ? 1 : -1;
      }
    });
  } catch (err) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error("xhamster getStream error:", err.message || err);
  }
  return streams;
};

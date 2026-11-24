import { ProviderContext, Stream } from "../types";

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
    const res = await providerContext.axios.get(link, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1; platform=pc;",
        Referer: link,
      },
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

    // 1. Try extracting flashvars JSON
    let mediaDefinitions: any[] = [];
    const flashvarsMatch = html.match(/flashvars_\d+\s*=\s*(\{.*?\});\s*(?:var|,|$)/s);
    if (flashvarsMatch) {
      try {
        const parsed = JSON.parse(flashvarsMatch[1]);
        if (Array.isArray(parsed.mediaDefinitions)) {
          mediaDefinitions = parsed.mediaDefinitions;
        }
      } catch (e) {}
    }

    if (mediaDefinitions.length === 0) {
      const mediaMatch = html.match(/\"mediaDefinitions\"\s*:\s*(\[.*?\])(?:,\s*\"|\s*\})/s);
      if (mediaMatch) {
        try {
          mediaDefinitions = JSON.parse(mediaMatch[1]);
        } catch (e) {}
      }
    }

    // 2. Process mediaDefinitions
    for (const m of mediaDefinitions) {
      const videoUrl: string = m.videoUrl || m.url;
      if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("http")) continue;

      const format = (m.format || "").toLowerCase();
      const quality = Array.isArray(m.quality) ? m.quality.join("/") : String(m.quality || "");
      const isHls = format === "hls" || videoUrl.includes(".m3u8");
      const isMp4 = format === "mp4" || videoUrl.includes(".mp4");

      streams.push({
        server: isHls
          ? `Pornhub HLS ${quality ? `(${quality}p)` : ""}`.trim()
          : `Pornhub Direct ${quality ? `(${quality}p)` : "MP4"}`.trim(),
        link: videoUrl,
        type: isHls ? "m3u8" : "mp4",
        quality: quality || undefined,
        headers: {
          Referer: link,
          Origin: new URL(link).origin,
          "User-Agent":
            providerContext.commonHeaders["User-Agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }

    // 3. Fallback regex search for direct .m3u8 and .mp4 URLs in HTML if mediaDefinitions failed
    if (streams.length === 0) {
      const m3u8Matches = html.match(/https?:\/\/[^"'\\s\s]+\.m3u8[^"'\\s\s]*/g) || [];
      for (const m3u8 of Array.from(new Set(m3u8Matches))) {
        streams.push({
          server: "Pornhub HLS Stream",
          link: m3u8.replace(/\\/g, ""),
          type: "m3u8",
          headers: { Referer: link },
        });
      }

      const mp4Matches = html.match(/https?:\/\/[^"'\\s\s]+\.mp4[^"'\\s\s]*/g) || [];
      for (const mp4 of Array.from(new Set(mp4Matches))) {
        if (!mp4.includes(".m3u8")) {
          streams.push({
            server: "Pornhub Direct Video",
            link: mp4.replace(/\\/g, ""),
            type: "mp4",
            headers: { Referer: link },
          });
        }
      }
    }

    // Sort: if isDownload is true, prioritize mp4 download links first; otherwise m3u8 streaming first
    streams.sort((a, b) => {
      const aIsMp4 = a.type === "mp4";
      const bIsMp4 = b.type === "mp4";
      if (isDownload) {
        return aIsMp4 === bIsMp4 ? 0 : aIsMp4 ? -1 : 1;
      } else {
        return aIsMp4 === bIsMp4 ? 0 : aIsMp4 ? 1 : -1;
      }
    });
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error("pornhub getStream error:", err.message || err);
  }
  return streams;
};

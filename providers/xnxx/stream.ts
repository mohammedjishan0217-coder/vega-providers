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
        Referer: link,
      },
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

    // 1. Extract HLS playlist
    const hlsMatch = html.match(/html5player\.setVideoHLS\(\s*'([^']+)'\s*\)/);
    if (hlsMatch && hlsMatch[1]) {
      streams.push({
        server: "XNXX HLS (Auto)",
        link: hlsMatch[1],
        type: "m3u8",
        headers: {
          Referer: link,
          Origin: new URL(link).origin,
          "User-Agent":
            providerContext.commonHeaders["User-Agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }

    // 2. Extract High Quality MP4
    const highMatch = html.match(/html5player\.setVideoUrlHigh\(\s*'([^']+)'\s*\)/);
    if (highMatch && highMatch[1]) {
      streams.push({
        server: "XNXX High Quality (MP4)",
        link: highMatch[1],
        type: "mp4",
        quality: "360",
        headers: {
          Referer: link,
          Origin: new URL(link).origin,
          "User-Agent":
            providerContext.commonHeaders["User-Agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }

    // 3. Extract Low Quality MP4
    const lowMatch = html.match(/html5player\.setVideoUrlLow\(\s*'([^']+)'\s*\)/);
    if (lowMatch && lowMatch[1]) {
      streams.push({
        server: "XNXX Standard Quality (MP4)",
        link: lowMatch[1],
        type: "mp4",
        quality: "240",
        headers: {
          Referer: link,
          Origin: new URL(link).origin,
          "User-Agent":
            providerContext.commonHeaders["User-Agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }

    // Fallback: regex search for .m3u8 and .mp4
    if (streams.length === 0) {
      const m3u8Matches = html.match(/https?:\/\/[^"'\\s\s]+\.m3u8[^"'\\s\s]*/g) || [];
      for (const m3u8 of Array.from(new Set(m3u8Matches))) {
        streams.push({
          server: "XNXX Stream",
          link: m3u8.replace(/\\/g, ""),
          type: "m3u8",
          headers: { Referer: link },
        });
      }

      const mp4Matches = html.match(/https?:\/\/[^"'\\s\s]+\.mp4[^"'\\s\s]*/g) || [];
      for (const mp4 of Array.from(new Set(mp4Matches))) {
        if (!mp4.includes(".m3u8")) {
          streams.push({
            server: "XNXX MP4",
            link: mp4.replace(/\\/g, ""),
            type: "mp4",
            headers: { Referer: link },
          });
        }
      }
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
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error("xnxx getStream error:", err.message || err);
  }
  return streams;
};

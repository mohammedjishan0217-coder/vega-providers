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
    let html = "";
    try {
      const res = await providerContext.axios.get(link, {
        headers: {
          ...providerContext.commonHeaders,
          Referer: link,
        },
        signal,
      });
      html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch (fetchErr: any) {
      if (fetchErr.response?.status === 403 && providerContext.openWebView) {
        const wv = await providerContext.openWebView(link, {
          title: "SpankBang Security Verification",
          waitForCookie: "cf_clearance",
          timeoutMs: 60000,
        });
        html = wv?.data || "";
      } else {
        throw fetchErr;
      }
    }

    // 1. Try extracting stream_data JSON
    const streamDataMatch = html.match(/(?:var|window\.)\s*stream_data\s*=\s*(\{.*?\});/s);
    if (streamDataMatch && streamDataMatch[1]) {
      try {
        const streamData = JSON.parse(streamDataMatch[1]);
        for (const [qualityKey, urlVal] of Object.entries(streamData)) {
          const urls = Array.isArray(urlVal) ? urlVal : [urlVal];
          for (const rawUrl of urls) {
            if (typeof rawUrl === "string" && rawUrl.startsWith("http")) {
              const isHls = rawUrl.includes(".m3u8");
              streams.push({
                server: isHls
                  ? `SpankBang HLS (${qualityKey})`
                  : `SpankBang MP4 (${qualityKey})`,
                link: rawUrl,
                type: isHls ? "m3u8" : "mp4",
                quality: qualityKey.replace("p", ""),
                headers: {
                  Referer: link,
                  Origin: new URL(link).origin,
                  "User-Agent":
                    providerContext.commonHeaders["User-Agent"] ||
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
              });
            }
          }
        }
      } catch (e) {}
    }

    // 2. Fallback regex search for .m3u8 and .mp4 URLs in HTML
    if (streams.length === 0) {
      const m3u8Matches = html.match(/https?:\/\/[^"'\\s\s]+\.m3u8[^"'\\s\s]*/g) || [];
      for (const m3u8 of Array.from(new Set(m3u8Matches))) {
        streams.push({
          server: "SpankBang HLS Stream",
          link: m3u8.replace(/\\/g, ""),
          type: "m3u8",
          headers: { Referer: link },
        });
      }

      const mp4Matches = html.match(/https?:\/\/[^"'\\s\s]+\.mp4[^"'\\s\s]*/g) || [];
      for (const mp4 of Array.from(new Set(mp4Matches))) {
        if (!mp4.includes(".m3u8")) {
          streams.push({
            server: "SpankBang MP4 Video",
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
    console.error("spankbang getStream error:", err.message || err);
  }
  return streams;
};

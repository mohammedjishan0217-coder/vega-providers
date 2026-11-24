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
        Cookie: "age_verified=1;",
        Referer: link,
      },
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const origin = new URL(link).origin;

    let mediaDefinitions: any[] = [];
    const mediaMatch =
      html.match(/mediaDefinition\s*:\s*(\[.*?\])\s*,\s*video_unavailable/s) ||
      html.match(/page_params\.mediaDefinition\s*=\s*(\[.*?\]);/s) ||
      html.match(/\"mediaDefinitions\"\s*:\s*(\[.*?\])/s);

    if (mediaMatch && mediaMatch[1]) {
      try {
        mediaDefinitions = JSON.parse(mediaMatch[1]);
      } catch (e) {}
    }

    for (const m of mediaDefinitions) {
      let videoUrl: string = m.videoUrl || m.url;
      if (!videoUrl || typeof videoUrl !== "string") continue;
      if (!videoUrl.startsWith("http")) {
        videoUrl = `${origin}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;
      }

      const format = (m.format || "").toLowerCase();
      const quality = Array.isArray(m.quality) ? m.quality.join("/") : String(m.quality || "");
      const isHls = format === "hls" || videoUrl.includes(".m3u8");

      if (videoUrl.includes("/media/")) {
        try {
          const mediaRes = await providerContext.axios.get(videoUrl, {
            headers: {
              ...providerContext.commonHeaders,
              Cookie: "age_verified=1;",
              Referer: link,
            },
            signal,
          });
          const mediaData = mediaRes.data;
          if (Array.isArray(mediaData)) {
            for (const item of mediaData) {
              const directUrl = item.videoUrl || item.url;
              if (directUrl && typeof directUrl === "string") {
                const subFormat = (item.format || "").toLowerCase();
                const itemQuality = Array.isArray(item.quality) ? item.quality.join("/") : String(item.quality || "");
                const isSubHls = subFormat === "hls" || directUrl.includes(".m3u8");
                streams.push({
                  server: isSubHls
                    ? `YouPorn HLS ${itemQuality ? `(${itemQuality}p)` : ""}`.trim()
                    : `YouPorn Direct ${itemQuality ? `(${itemQuality}p)` : "MP4"}`.trim(),
                  link: directUrl,
                  type: isSubHls ? "m3u8" : "mp4",
                  quality: itemQuality || undefined,
                  headers: { Referer: link, Origin: origin },
                });
              }
            }
          }
        } catch (subErr) {}
      } else {
        streams.push({
          server: isHls
            ? `YouPorn HLS ${quality ? `(${quality}p)` : ""}`.trim()
            : `YouPorn Direct ${quality ? `(${quality}p)` : "MP4"}`.trim(),
          link: videoUrl,
          type: isHls ? "m3u8" : "mp4",
          quality: quality || undefined,
          headers: { Referer: link, Origin: origin },
        });
      }
    }

    if (streams.length === 0) {
      const m3u8Matches = html.match(/https?:\/\/[^"'\\s\s]+\.m3u8[^"'\\s\s]*/g) || [];
      for (const m3u8 of Array.from(new Set(m3u8Matches))) {
        streams.push({
          server: "YouPorn HLS Stream",
          link: m3u8.replace(/\\/g, ""),
          type: "m3u8",
          headers: { Referer: link },
        });
      }

      const mp4Matches = html.match(/https?:\/\/[^"'\\s\s]+\.mp4[^"'\\s\s]*/g) || [];
      for (const mp4 of Array.from(new Set(mp4Matches))) {
        if (!mp4.includes(".m3u8")) {
          streams.push({
            server: "YouPorn MP4 Video",
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
    console.error("youporn getStream error:", err.message || err);
  }
  return streams;
};

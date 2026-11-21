import { Stream, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://hanime.tv";

async function resolveBaseUrl(providerContext: ProviderContext): Promise<string> {
  const custom = await providerContext.kvStore?.get<string>("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

function extractSlugFromLink(link: string): string {
  if (!link) return "";
  try {
    const cleaned = link.split("?")[0].split("#")[0].replace(/\/+$/, "");
    if (cleaned.includes("/videos/hentai/")) {
      return cleaned.split("/videos/hentai/")[1].split("/")[0];
    }
    if (cleaned.includes("/hentai/")) {
      return cleaned.split("/hentai/")[1].split("/")[0];
    }
    if (cleaned.includes("id=")) {
      const match = link.match(/[?&]id=([^&#]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

function parseManifestToStreams(
  manifest: any,
  headers: Record<string, string>,
  allowedResolutions?: string[]
): Stream[] {
  const streams: Stream[] = [];
  const servers = Array.isArray(manifest?.servers) ? manifest.servers : [];

  for (const server of servers) {
    const serverName = (server?.name || "Hanime CDN").trim();
    const serverStreams = Array.isArray(server?.streams) ? server.streams : [];

    for (const s of serverStreams) {
      const streamUrl = (s?.url || s?.extra2 || "").trim();
      if (!streamUrl) continue;

      const rawHeight = String(s?.height || "720").replace(/[^0-9]/g, "") || "720";
      if (
        Array.isArray(allowedResolutions) &&
        allowedResolutions.length > 0 &&
        !allowedResolutions.includes(rawHeight)
      ) {
        continue;
      }

      const isHls =
        /\.m3u8(\?|$)/i.test(streamUrl) ||
        streamUrl.includes("/m3u8s/") ||
        String(s?.extension || "").toLowerCase() === "m3u8";
      const isDash = /\.mpd(\?|$)/i.test(streamUrl);
      const streamType: Stream["type"] = isHls ? "m3u8" : isDash ? "mpd" : "mp4";

      const sizeLabel = s?.size_mbs ? ` (${s.size_mbs} MB)` : "";
      streams.push({
        server: `${serverName} - ${rawHeight}p${sizeLabel}`,
        link: streamUrl,
        type: streamType,
        quality: rawHeight,
        headers,
      });
    }
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
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  try {
    const { axios, commonHeaders, kvStore } = providerContext;
    const baseUrl = await resolveBaseUrl(providerContext);
    const preferredQuality = (await kvStore?.get<string>("preferredQuality")) || "auto";
    const allowedResolutions =
      (await kvStore?.get<string[]>("allowedResolutions")) || ["1080", "720", "480", "360"];

    if (/\.(m3u8|mp4|mkv|mpd)(\?|$)/i.test(link)) {
      const extMatch = link.match(/\.(m3u8|mp4|mkv|mpd)/i);
      const streamType = (extMatch ? extMatch[1].toLowerCase() : "m3u8") as Stream["type"];
      return [
        {
          server: "Direct Stream",
          link,
          type: streamType,
          quality: "1080",
          headers: {
            ...commonHeaders,
            Origin: baseUrl,
            Referer: `${baseUrl}/`,
          },
        },
      ];
    }

    const slug = extractSlugFromLink(link);
    if (!slug) return [];

    const watchUrl = `${baseUrl}/videos/hentai/${slug}`;
    const streamHeaders: Record<string, string> = {
      ...commonHeaders,
      Origin: baseUrl,
      Referer: watchUrl,
    };

    let streams: Stream[] = [];
    let videoId: string | number = "";

    try {
      const apiUrl = `${baseUrl}/api/v8/video?id=${encodeURIComponent(slug)}`;
      const res = await axios.get(apiUrl, {
        headers: {
          ...streamHeaders,
          Accept: "application/json, text/plain, */*",
          "X-Signature-Version": "web2",
        },
        signal,
      });

      const data = res?.data;
      if (data?.hentai_video?.id) {
        videoId = data.hentai_video.id;
      }

      if (data?.videos_manifest) {
        streams.push(
          ...parseManifestToStreams(data.videos_manifest, streamHeaders, allowedResolutions)
        );
      }
    } catch {}

    if (streams.length === 0 && videoId) {
      streams.push({
        server: "Highwinds HLS - 720p",
        link: `https://weeb.hanime.tv/weeb-api-cache/api/v8/m3u8s/${videoId}.m3u8`,
        type: "m3u8",
        quality: "720",
        headers: streamHeaders,
      });
    }

    if (streams.length === 0) {
      try {
        const pageRes = await axios.get(watchUrl, {
          headers: streamHeaders,
          signal,
        });
        const html = typeof pageRes.data === "string" ? pageRes.data : JSON.stringify(pageRes.data);

        const mediaRegex = /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\]*)?/gi;
        const matches = Array.from(new Set(html.match(mediaRegex) || []));
        for (const [idx, mediaUrl] of matches.entries()) {
          const cleanUrl = mediaUrl.replace(/\\u002F/g, "/").replace(/\\/g, "");
          const isHls = /\.m3u8/i.test(cleanUrl);
          const qualityMatch = cleanUrl.match(/(1080|720|480|360)/);
          const quality = qualityMatch ? qualityMatch[1] : "720";
          streams.push({
            server: `Hanime ${isHls ? "HLS" : "MP4"} ${idx + 1} - ${quality}p`,
            link: cleanUrl,
            type: isHls ? "m3u8" : "mp4",
            quality,
            headers: streamHeaders,
          });
        }
      } catch {}
    }

    if (streams.length === 0 && providerContext.openWebView) {
      try {
        const wvResult = await providerContext.openWebView(watchUrl, {
          title: "Loading Hanime Stream...",
          timeoutMs: 45000,
          injectedJavaScript: `
            (function() {
              try {
                const nuxt = window.__NUXT__;
                const manifest = nuxt && nuxt.state && nuxt.state.data && nuxt.state.data.video && nuxt.state.data.video.videos_manifest;
                if (manifest) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    __waf: true,
                    data: { manifest }
                  }));
                }
              } catch (e) {}
            })();
          `,
        });

        const wvData = wvResult?.data;
        if (wvData?.manifest) {
          streams.push(
            ...parseManifestToStreams(wvData.manifest, streamHeaders, allowedResolutions)
          );
        }
      } catch {}
    }

    const uniqueStreams: Stream[] = [];
    const seenLinks = new Set<string>();
    for (const s of streams) {
      if (s.link && !seenLinks.has(s.link)) {
        seenLinks.add(s.link);
        uniqueStreams.push(s);
      }
    }

    uniqueStreams.sort((a, b) => {
      const aIsDirect = a.type === "mp4" || a.type === "mkv";
      const bIsDirect = b.type === "mp4" || b.type === "mkv";
      if (isDownload) {
        if (aIsDirect !== bIsDirect) return Number(bIsDirect) - Number(aIsDirect);
      } else {
        if (aIsDirect !== bIsDirect) return Number(!bIsDirect) - Number(!aIsDirect);
      }

      if (preferredQuality && preferredQuality !== "auto") {
        const aMatchesPref = a.quality === preferredQuality;
        const bMatchesPref = b.quality === preferredQuality;
        if (aMatchesPref !== bMatchesPref) return Number(bMatchesPref) - Number(aMatchesPref);
      }

      const aRes = parseInt(String(a.quality || "0"), 10) || 0;
      const bRes = parseInt(String(b.quality || "0"), 10) || 0;
      return bRes - aRes;
    });

    return uniqueStreams;
  } catch (error) {
    console.error("hanime getStream error:", error);
    return [];
  }
};

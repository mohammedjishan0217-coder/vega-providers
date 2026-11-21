import { Stream, ProviderContext } from "../types";

const DEFAULT_BASE = "https://hanime.tv";

async function getBase(ctx: ProviderContext): Promise<string> {
  const custom = await ctx.kvStore?.get<string>("baseUrlOverride");
  return (custom && custom.trim()) ? custom.trim().replace(/\/+$/, "") : DEFAULT_BASE;
}

function getSlug(link: string): string {
  const m = link.match(/\/videos\/hentai\/([^/?#]+)/) || link.match(/[?&]id=([^&#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return link.replace(/\/+$/, "").split("/").pop() || "";
}

export const getStream = async function ({
  link,
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
    const baseUrl = await getBase(providerContext);
    const slug = getSlug(link);
    if (!slug) return [];
    const headers = {
      ...providerContext.commonHeaders,
      Origin: baseUrl,
      Referer: `${baseUrl}/videos/hentai/${slug}`,
    };
    const res = await providerContext.axios.get(`${baseUrl}/api/v8/video?id=${encodeURIComponent(slug)}`, {
      headers,
      signal,
    });
    const servers = Array.isArray(res?.data?.videos_manifest?.servers)
      ? res.data.videos_manifest.servers
      : [];
    const allowed = (await providerContext.kvStore?.get<string[]>("allowedResolutions")) || ["1080", "720", "480", "360"];
    const preferred = (await providerContext.kvStore?.get<string>("preferredQuality")) || "auto";
    const streams: Stream[] = [];
    for (const srv of servers) {
      const srvName = srv?.name || "Hanime Server";
      for (const st of (srv?.streams || [])) {
        if (!st?.url) continue;
        const q = String(st.height || "720").replace(/[^0-9]/g, "") || "720";
        if (allowed.length > 0 && !allowed.includes(q)) continue;
        const ext = (st.extension === "m3u8" || /\.m3u8(\?|$)/i.test(st.url)) ? "m3u8" : "mp4";
        streams.push({
          server: `${srvName} (${q}p)`,
          link: st.url,
          type: ext,
          quality: q as any,
          headers,
        });
      }
    }
    streams.sort((a, b) => {
      if (preferred !== "auto") {
        if (a.quality === preferred && b.quality !== preferred) return -1;
        if (b.quality === preferred && a.quality !== preferred) return 1;
      }
      if (isDownload) {
        if (a.type === "mp4" && b.type !== "mp4") return -1;
        if (b.type === "mp4" && a.type !== "mp4") return 1;
      } else {
        if (a.type === "m3u8" && b.type !== "m3u8") return -1;
        if (b.type === "m3u8" && a.type !== "m3u8") return 1;
      }
      return Number(b.quality || 0) - Number(a.quality || 0);
    });
    return streams;
  } catch (e) {
    return [];
  }
};

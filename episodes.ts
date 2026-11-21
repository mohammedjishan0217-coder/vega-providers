import { EpisodeLink, ProviderContext } from "../types";

const DEFAULT_BASE = "https://hanime.tv";

async function getBase(ctx: ProviderContext): Promise<string> {
  const custom = await ctx.kvStore?.get<string>("baseUrlOverride");
  return (custom && custom.trim()) ? custom.trim().replace(/\/+$/, "") : DEFAULT_BASE;
}

function getSlug(url: string): string {
  const m = url.match(/\/videos\/hentai\/([^/?#]+)/) || url.match(/[?&]id=([^&#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return url.replace(/\/+$/, "").split("/").pop() || "";
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    const baseUrl = await getBase(providerContext);
    const slug = getSlug(url);
    if (!slug) return [];
    const res = await providerContext.axios.get(`${baseUrl}/api/v8/video?id=${encodeURIComponent(slug)}`, {
      headers: { ...providerContext.commonHeaders, Referer: `${baseUrl}/videos/hentai/${slug}` },
    });
    const list = Array.isArray(res?.data?.hentai_franchise_hentai_videos)
      ? res.data.hentai_franchise_hentai_videos
      : [];
    if (list.length > 0) {
      return list.map((ep: any, i: number) => ({
        title: ep.name ? `${i + 1}. ${ep.name}` : `Episode ${i + 1}`,
        link: `${baseUrl}/videos/hentai/${ep.slug}`,
      }));
    }
    return [{ title: res?.data?.hentai_video?.name || "Episode 1", link: `${baseUrl}/videos/hentai/${slug}` }];
  } catch (e) {
    return [];
  }
};

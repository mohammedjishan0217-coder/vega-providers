import { Info, ProviderContext } from "../types";

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

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const baseUrl = await getBase(providerContext);
    const slug = getSlug(link);
    if (!slug) return { title: "", synopsis: "", image: "", imdbId: "", type: "movie", linkList: [] };
    const apiUrl = `${baseUrl}/api/v8/video?id=${encodeURIComponent(slug)}`;
    const headers = { ...providerContext.commonHeaders, Referer: `${baseUrl}/videos/hentai/${slug}` };
    const res = await providerContext.axios.get(apiUrl, { headers });
    const data = res?.data;
    const hv = data?.hentai_video || {};
    const franchise = Array.isArray(data?.hentai_franchise_hentai_videos)
      ? data.hentai_franchise_hentai_videos
      : [];
    const directLinks = franchise.length > 0
      ? franchise.map((ep: any, i: number) => ({
          title: ep.name ? `${i + 1}. ${ep.name}` : `Episode ${i + 1}`,
          link: `${baseUrl}/videos/hentai/${ep.slug}`,
          type: franchise.length > 1 ? "series" : "movie",
        }))
      : [{ title: hv.name || "Play Video", link: `${baseUrl}/videos/hentai/${slug}`, type: "movie" }];
    const cleanDesc = String(hv.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      title: String(hv.name || slug),
      synopsis: cleanDesc,
      image: String(hv.cover_url || hv.poster_url || ""),
      imdbId: "",
      type: franchise.length > 1 ? "series" : "movie",
      linkList: [
        {
          title: data?.hentai_franchise?.title || hv.name || "Episodes",
          quality: "1080",
          episodesLink: `${baseUrl}/videos/hentai/${slug}`,
          directLinks,
        },
      ],
    };
  } catch (e) {
    return { title: "", synopsis: "", image: "", imdbId: "", type: "movie", linkList: [] };
  }
};

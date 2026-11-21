import { Info, ProviderContext } from "../types";

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

function stripHtml(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio, commonHeaders } = providerContext;
    const baseUrl = await resolveBaseUrl(providerContext);
    const slug = extractSlugFromLink(link);

    if (!slug) {
      throw new Error(`Invalid hanime video link: ${link}`);
    }

    const apiUrl = `${baseUrl}/api/v8/video?id=${encodeURIComponent(slug)}`;
    let videoData: any = null;

    try {
      const res = await axios.get(apiUrl, {
        headers: {
          ...commonHeaders,
          Accept: "application/json, text/plain, */*",
          Origin: baseUrl,
          Referer: `${baseUrl}/videos/hentai/${slug}`,
          "X-Signature-Version": "web2",
        },
      });
      videoData = res?.data;
    } catch {
      videoData = null;
    }

    if (!videoData || !videoData.hentai_video) {
      const pageUrl = `${baseUrl}/videos/hentai/${slug}`;
      const pageRes = await axios.get(pageUrl, {
        headers: {
          ...commonHeaders,
          Referer: `${baseUrl}/`,
        },
      });
      const html = typeof pageRes.data === "string" ? pageRes.data : "";

      const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
      if (nuxtMatch && nuxtMatch[1]) {
        try {
          const parsedNuxt = JSON.parse(nuxtMatch[1]);
          videoData = parsedNuxt?.state?.data?.video || parsedNuxt?.data?.[0] || null;
        } catch {
          videoData = null;
        }
      }

      if (!videoData || !videoData.hentai_video) {
        const $ = cheerio.load(html);
        const title =
          $("meta[property='og:title']").attr("content")?.trim() ||
          $("h1").first().text().trim() ||
          slug;
        const synopsis =
          $("meta[property='og:description']").attr("content")?.trim() ||
          $("meta[name='description']").attr("content")?.trim() ||
          "No synopsis available.";
        const image =
          $("meta[property='og:image']").attr("content")?.trim() || "";

        return {
          title,
          synopsis,
          image,
          imdbId: "",
          type: "movie",
          linkList: [
            {
              title: "Watch / Download",
              quality: "1080",
              directLinks: [
                {
                  title,
                  link: pageUrl,
                  type: "movie",
                  quality: "1080",
                },
              ],
            },
          ],
        };
      }
    }

    const hv = videoData.hentai_video || {};
    const title = (hv.name || slug).trim();
    const synopsis = stripHtml(hv.description) || "No synopsis available.";
    const image = hv.cover_url || hv.poster_url || "";
    const tags: string[] = Array.isArray(hv.hentai_tags)
      ? hv.hentai_tags.map((t: any) => t?.text).filter(Boolean)
      : [];
    const brand = hv.brand ? [String(hv.brand)] : [];
    const likes = Number(hv.likes || 0);
    const dislikes = Number(hv.dislikes || 0);
    const rating =
      likes + dislikes > 0
        ? `${((likes / (likes + dislikes)) * 10).toFixed(1)}/10`
        : undefined;

    const franchiseVideos: any[] = Array.isArray(videoData.hentai_franchise_hentai_videos)
      ? videoData.hentai_franchise_hentai_videos
      : [];

    const directLinks =
      franchiseVideos.length > 0
        ? franchiseVideos.map((ep: any, idx: number) => ({
            title: (ep.name || `Episode ${idx + 1}`).trim(),
            link: `${baseUrl}/videos/hentai/${ep.slug || slug}`,
            type: (franchiseVideos.length > 1 ? "series" : "movie") as "movie" | "series",
            quality: "1080",
          }))
        : [
            {
              title: title || "Episode 1",
              link: `${baseUrl}/videos/hentai/${hv.slug || slug}`,
              type: "movie" as const,
              quality: "1080",
            },
          ];

    const franchiseTitle =
      videoData.hentai_franchise?.title?.trim() ||
      (franchiseVideos.length > 1 ? `${title} (Franchise Episodes)` : "Watch / Download");

    return {
      title,
      synopsis,
      image,
      imdbId: "",
      type: franchiseVideos.length > 1 ? "series" : "movie",
      tags,
      cast: brand,
      rating,
      linkList: [
        {
          title: franchiseTitle,
          quality: "1080",
          directLinks,
        },
      ],
    };
  } catch (error) {
    console.error("hanime getMeta error:", error);
    return {
      title: "",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "movie",
      linkList: [],
    };
  }
};

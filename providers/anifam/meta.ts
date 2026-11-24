import { Info, Link, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://anifam.net";

async function resolveBaseUrl(providerContext: ProviderContext): Promise<string> {
  try {
    const override = await providerContext.kvStore?.get<string>("baseUrlOverride");
    if (override && typeof override === "string" && override.trim().length > 0) {
      return override.trim().replace(/\/+$/, "");
    }
  } catch (e) {}
  if (providerContext.getBaseUrl) {
    try {
      const url = await providerContext.getBaseUrl();
      if (url) return url.replace(/\/+$/, "");
    } catch (e) {}
  }
  return DEFAULT_BASE_URL;
}

function formatImageUrl(baseUrl: string, poster?: string): string {
  if (!poster) return "";
  if (poster.startsWith("http://") || poster.startsWith("https://")) return poster;
  if (poster.startsWith("//")) return `https:${poster}`;
  return `${baseUrl}${poster.startsWith("/") ? "" : "/"}${poster}`;
}

function extractAnimeId(link: string): string {
  const match = link.match(/\/anime\/(\d+)/) || link.match(/(\d+)$/);
  return match ? match[1] : link.trim();
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const animeId = extractAnimeId(link);

    // 1. Fetch anime detail
    const detailRes = await providerContext.axios.get(
      `${baseUrl}/api/v1/app/anime/${animeId}`,
      {
        headers: {
          ...providerContext.commonHeaders,
          Accept: "application/json",
          Referer: baseUrl,
        },
      }
    );

    const detail = detailRes?.data || {};
    const title = detail.title || detail.title_romaji || detail.title_jp || "Untitled Anime";
    const synopsis = detail.synopsis || "";
    const image = formatImageUrl(baseUrl, detail.poster || detail.banner);
    const isMovie = detail.type && detail.type.toLowerCase() === "movie";
    const mediaType = isMovie ? "movie" : "series";

    const tags: string[] = [];
    if (Array.isArray(detail.genres)) {
      for (const g of detail.genres) {
        if (typeof g === "string") tags.push(g);
        else if (g && g.name) tags.push(g.name);
      }
    }

    const imdbId = detail.imdb_id || (detail.mal_id ? `mal:${detail.mal_id}` : "");

    // 2. Fetch episodes list
    const epsRes = await providerContext.axios.get(
      `${baseUrl}/api/v1/app/anime/${animeId}/episodes`,
      {
        headers: {
          ...providerContext.commonHeaders,
          Accept: "application/json",
          Referer: baseUrl,
        },
      }
    );

    const episodesData = epsRes?.data?.data || [];
    const ranges = epsRes?.data?.ranges || [];
    const linkList: Link[] = [];

    if (isMovie) {
      const firstEp = episodesData[0] || { id: animeId, has_sub: true, has_dub: false };
      linkList.push({
        title: "Subtitled",
        directLinks: [
          {
            title: "Movie (Sub)",
            link: `${baseUrl}/api/v1/app/episodes/${firstEp.id}/play?track=sub`,
            type: "movie",
          },
        ],
      });

      if (firstEp.has_dub) {
        linkList.push({
          title: "English Dub",
          directLinks: [
            {
              title: "Movie (Dub)",
              link: `${baseUrl}/api/v1/app/episodes/${firstEp.id}/play?track=dub`,
              type: "movie",
            },
          ],
        });
      }
    } else {
      const hasAnyDub = episodesData.some((ep: any) => ep && ep.has_dub);

      if (Array.isArray(ranges) && ranges.length > 1) {
        for (const range of ranges) {
          const fromNum = range.from || 1;
          const toNum = range.to || 100;
          const rangeEps = episodesData.filter(
            (ep: any) => ep && ep.number >= fromNum && ep.number <= toNum
          );

          // Sub link list
          linkList.push({
            title: `Episodes ${fromNum}-${toNum} (Sub)`,
            directLinks: rangeEps.map((ep: any) => ({
              title: ep.title && ep.title !== `Episode ${ep.number}` ? `Ep ${ep.number}: ${ep.title}` : `Episode ${ep.number}`,
              link: `${baseUrl}/api/v1/app/episodes/${ep.id}/play?track=sub`,
              type: "series",
            })),
          });

          // Dub link list if available in this range
          const rangeDubEps = rangeEps.filter((ep: any) => ep.has_dub);
          if (rangeDubEps.length > 0) {
            linkList.push({
              title: `Episodes ${fromNum}-${toNum} (Dub)`,
              directLinks: rangeDubEps.map((ep: any) => ({
                title: ep.title && ep.title !== `Episode ${ep.number}` ? `Ep ${ep.number}: ${ep.title}` : `Episode ${ep.number}`,
                link: `${baseUrl}/api/v1/app/episodes/${ep.id}/play?track=dub`,
                type: "series",
              })),
            });
          }
        }
      } else {
        // Single range or all episodes in one list
        linkList.push({
          title: "Episodes (Sub)",
          directLinks: episodesData.map((ep: any) => ({
            title: ep.title && ep.title !== `Episode ${ep.number}` ? `Ep ${ep.number}: ${ep.title}` : `Episode ${ep.number}`,
            link: `${baseUrl}/api/v1/app/episodes/${ep.id}/play?track=sub`,
            type: "series",
          })),
        });

        if (hasAnyDub) {
          const dubEps = episodesData.filter((ep: any) => ep.has_dub);
          linkList.push({
            title: "Episodes (Dub)",
            directLinks: dubEps.map((ep: any) => ({
              title: ep.title && ep.title !== `Episode ${ep.number}` ? `Ep ${ep.number}: ${ep.title}` : `Episode ${ep.number}`,
              link: `${baseUrl}/api/v1/app/episodes/${ep.id}/play?track=dub`,
              type: "series",
            })),
          });
        }
      }
    }

    return {
      title,
      synopsis,
      image,
      poster: image,
      type: mediaType,
      imdbId,
      rating: detail.score ? String(detail.score) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      linkList,
    };
  } catch (err: any) {
    console.error("[anifam] getMeta error:", err.message || err);
    return {
      title: "Error Loading Anime",
      synopsis: "",
      image: "",
      type: "series",
      imdbId: "",
      linkList: [],
    };
  }
};

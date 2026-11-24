"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchPosts = exports.getPosts = void 0;

const DEFAULT_BASE_URL = "https://anifam.net";

async function resolveBaseUrl(providerContext) {
  try {
    const override = await providerContext.kvStore?.get("baseUrlOverride");
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

function formatImageUrl(baseUrl, poster) {
  if (!poster) return "";
  if (poster.startsWith("http://") || poster.startsWith("https://")) return poster;
  if (poster.startsWith("//")) return `https:${poster}`;
  return `${baseUrl}${poster.startsWith("/") ? "" : "/"}${poster}`;
}

function mapAnimeCardToPost(baseUrl, item) {
  const title = item.title || item.title_romaji || item.title_jp || "Untitled";
  const image = formatImageUrl(baseUrl, item.poster || item.banner);
  const link = `${baseUrl}/api/v1/app/anime/${item.id}`;

  const tags = [];
  if (item.type) tags.push(item.type);
  if (typeof item.eps === "number" && item.eps > 0) {
    tags.push(`${item.eps} Eps`);
  } else if (typeof item.sub === "number" && item.sub > 0) {
    tags.push(`Sub ${item.sub}`);
  }

  return {
    title,
    link,
    image,
    cornerTag: item.score ? `★ ${item.score}` : undefined,
    tag: tags.length > 0 ? tags.join(" • ") : undefined,
  };
}

exports.getPosts = async function ({
  filter,
  page,
  providerValue,
  signal,
  providerContext,
}) {
  const posts = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const currentPage = Math.max(1, page || 1);

    // Genre filter
    if (filter && filter.startsWith("genre:")) {
      const genreSlug = filter.replace("genre:", "").trim();
      const res = await providerContext.axios.get(
        `${baseUrl}/api/v1/app/browse?genre=${encodeURIComponent(genreSlug)}&page=${currentPage}`,
        {
          headers: {
            ...providerContext.commonHeaders,
            Accept: "application/json",
            Referer: baseUrl,
          },
          signal,
        }
      );

      const items = res?.data?.data;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            posts.push(mapAnimeCardToPost(baseUrl, item));
          }
        }
      }
      return posts;
    }

    // Home sections
    if (currentPage === 1) {
      const res = await providerContext.axios.get(`${baseUrl}/api/v1/app/home`, {
        headers: {
          ...providerContext.commonHeaders,
          Accept: "application/json",
          Referer: baseUrl,
        },
        signal,
      });

      const data = res?.data;
      let rawList = [];

      switch (filter) {
        case "trending":
          rawList = data?.trending || [];
          break;
        case "latest":
          rawList = data?.latest || [];
          break;
        case "new_releases":
          rawList = data?.new_releases || [];
          break;
        case "top_airing":
          rawList = data?.top_airing || [];
          break;
        case "most_popular":
          rawList = data?.most_popular || [];
          break;
        case "completed":
          rawList = data?.completed || [];
          break;
        case "top_movies":
          rawList = data?.top_movies || [];
          break;
        case "top10_today":
          rawList = data?.top10?.today || [];
          break;
        case "top10_week":
          rawList = data?.top10?.week || [];
          break;
        case "top10_month":
          rawList = data?.top10?.month || [];
          break;
        default:
          rawList = data?.trending || data?.spotlight || [];
          break;
      }

      if (Array.isArray(rawList)) {
        for (const item of rawList) {
          if (item && item.id) {
            posts.push(mapAnimeCardToPost(baseUrl, item));
          }
        }
      }
    } else {
      // Pagination for page >= 2 via browse endpoint
      let browseQuery = `page=${currentPage}`;
      if (filter === "top_movies") {
        browseQuery += "&type=Movie";
      } else if (filter === "completed") {
        browseQuery += "&status=completed";
      } else if (filter === "top_airing") {
        browseQuery += "&status=airing";
      } else if (filter === "most_popular") {
        browseQuery += "&sort=popular";
      } else if (filter === "latest" || filter === "new_releases") {
        browseQuery += "&sort=latest";
      }

      const res = await providerContext.axios.get(`${baseUrl}/api/v1/app/browse?${browseQuery}`, {
        headers: {
          ...providerContext.commonHeaders,
          Accept: "application/json",
          Referer: baseUrl,
        },
        signal,
      });

      const items = res?.data?.data;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.id) {
            posts.push(mapAnimeCardToPost(baseUrl, item));
          }
        }
      }
    }
  } catch (err) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getPosts error:`, err.message || err);
  }
  return posts;
};

exports.getSearchPosts = async function ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext,
}) {
  const posts = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const currentPage = Math.max(1, page || 1);

    const res = await providerContext.axios.get(
      `${baseUrl}/api/v1/app/search?q=${encodeURIComponent(searchQuery)}&page=${currentPage}`,
      {
        headers: {
          ...providerContext.commonHeaders,
          Accept: "application/json",
          Referer: baseUrl,
        },
        signal,
      }
    );

    const items = res?.data?.data;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && item.id) {
          posts.push(mapAnimeCardToPost(baseUrl, item));
        }
      }
    }
  } catch (err) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getSearchPosts error:`, err.message || err);
  }
  return posts;
};

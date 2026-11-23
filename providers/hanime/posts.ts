import { Post, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://hanime.tv";
const SEARCH_DATABASE_URL = "https://guest.freeanimehentai.net/api/v11/search_hvs";

let cachedDb: any[] | null = null;
let cachedDbTime = 0;

async function resolveBaseUrl(providerContext: ProviderContext): Promise<string> {
  try {
    const override = await providerContext.kvStore?.get<string>("baseUrlOverride");
    if (override && override.trim().length > 0) {
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

async function getSearchDatabase(axios: any, signal?: AbortSignal): Promise<any[]> {
  const now = Date.now();
  if (cachedDb && now - cachedDbTime < 30 * 60 * 1000) {
    return cachedDb;
  }
  try {
    const res = await axios.get(SEARCH_DATABASE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal,
    });
    const items = res?.data?.data;
    if (Array.isArray(items) && items.length > 0) {
      cachedDb = items;
      cachedDbTime = now;
      return items;
    }
  } catch (e: any) {
    if (e.name === "CanceledError" || e.name === "AbortError") throw e;
    console.error("[hanime] Failed to fetch search database:", e.message || e);
  }
  return cachedDb || [];
}

export const getPosts = async function ({
  filter,
  page,
  providerValue,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const posts: Post[] = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const currentPage = Math.max(1, page || 1);

    // If filter is HTML route (e.g. /browse/trending or /browse/tags/...)
    if (filter && filter.startsWith("/")) {
      const sep = filter.includes("?") ? "&" : "?";
      const targetUrl =
        currentPage > 1
          ? `${baseUrl}${filter}${sep}page=${currentPage}`
          : `${baseUrl}${filter}`;

      const res = await providerContext.axios.get(targetUrl, {
        headers: {
          ...providerContext.commonHeaders,
          Referer: baseUrl,
        },
        signal,
      });

      const $ = providerContext.cheerio.load(res.data);
      $("a[href^='/videos/hentai/']").each((_: number, el: any) => {
        const $el = $(el);
        const link = $el.attr("href");
        const title =
          $el.find("h3").first().text().trim() || $el.attr("title") || "";
        const img =
          $el.find("img").attr("src") || $el.find("img").attr("data-src") || "";

        if (link && title) {
          const fullLink = link.startsWith("http") ? link : `${baseUrl}${link}`;
          const fullImg = img.startsWith("//")
            ? `https:${img}`
            : img.startsWith("http")
            ? img
            : `${baseUrl}${img}`;
          if (!posts.some((p) => p.link === fullLink)) {
            posts.push({
              title,
              link: fullLink,
              image: fullImg,
            });
          }
        }
      });
      return posts;
    }

    // Otherwise, use search database sorted by order_by
    const db = await getSearchDatabase(providerContext.axios, signal);
    const sorted = [...db];

    if (filter.includes("order=created_at_desc")) {
      sorted.sort((a, b) => (b.created_at_unix || 0) - (a.created_at_unix || 0));
    } else if (filter.includes("order=released_at_desc")) {
      sorted.sort((a, b) => (b.released_at_unix || 0) - (a.released_at_unix || 0));
    } else if (filter.includes("order=views_desc")) {
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (filter.includes("order=likes_desc")) {
      sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else {
      sorted.sort((a, b) => (b.created_at_unix || 0) - (a.created_at_unix || 0));
    }

    const pageSize = 24;
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = sorted.slice(startIndex, startIndex + pageSize);

    for (const item of pageItems) {
      if (item && item.slug && item.name) {
        posts.push({
          title: item.name,
          link: `${baseUrl}/videos/hentai/${item.slug}`,
          image: item.cover_url || item.poster_url || "",
        });
      }
    }
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getPosts error:`, err.message || err);
  }
  return posts;
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const posts: Post[] = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const currentPage = Math.max(1, page || 1);
    const query = (searchQuery || "").trim().toLowerCase();

    if (!query) {
      return getPosts({
        filter: "/browse/trending",
        page,
        providerValue,
        signal,
        providerContext,
      });
    }

    const db = await getSearchDatabase(providerContext.axios, signal);
    const terms = query.split(/\s+/).filter(Boolean);

    const matches = db.filter((item) => {
      const searchable = `${item.name || ""} ${item.search_titles || ""} ${(
        item.tags || []
      ).join(" ")}`.toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });

    const pageSize = 24;
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = matches.slice(startIndex, startIndex + pageSize);

    for (const item of pageItems) {
      if (item && item.slug && item.name) {
        posts.push({
          title: item.name,
          link: `${baseUrl}/videos/hentai/${item.slug}`,
          image: item.cover_url || item.poster_url || "",
        });
      }
    }
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getSearchPosts error:`, err.message || err);
  }
  return posts;
};

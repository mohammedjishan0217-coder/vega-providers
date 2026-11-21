import { Post, ProviderContext } from "../types";

const DEFAULT_BASE = "https://hanime.tv";
const SEARCH_API = "https://search.htv-services.com/";

async function getBase(ctx: ProviderContext): Promise<string> {
  const custom = await ctx.kvStore?.get<string>("baseUrlOverride");
  return (custom && custom.trim()) ? custom.trim().replace(/\/+$/, "") : DEFAULT_BASE;
}

async function fetchHtv(
  searchText: string,
  filter: string,
  page: number,
  signal: AbortSignal,
  ctx: ProviderContext
): Promise<Post[]> {
  const baseUrl = await getBase(ctx);
  let order_by = "created_at_unix";
  let ordering = "desc";
  const tags: string[] = [];
  if (filter) {
    for (const part of filter.replace(/^[/?]+/, "").split("&")) {
      const [k, v] = part.split("=");
      if (k === "order_by" && v) order_by = decodeURIComponent(v);
      else if (k === "ordering" && v) ordering = decodeURIComponent(v);
      else if (k === "tag" && v) tags.push(decodeURIComponent(v).replace(/-/g, " "));
    }
  }
  const res = await ctx.axios.post(
    SEARCH_API,
    {
      search_text: searchText || "",
      tags,
      tags_mode: "AND",
      brands: [],
      blacklist: [],
      order_by,
      ordering,
      page: Math.max(0, (Number(page) || 1) - 1),
    },
    {
      headers: {
        ...ctx.commonHeaders,
        "Content-Type": "application/json;charset=UTF-8",
        Origin: baseUrl,
        Referer: baseUrl + "/",
      },
      signal,
    }
  );
  const rawHits = res?.data?.hits;
  const hits = typeof rawHits === "string" ? JSON.parse(rawHits) : (Array.isArray(rawHits) ? rawHits : []);
  return hits
    .filter((h: any) => h && h.slug)
    .map((h: any) => ({
      title: String(h.name || h.slug),
      link: `${baseUrl}/videos/hentai/${h.slug}`,
      image: String(h.cover_url || h.poster_url || ""),
    }));
}

export const getPosts = async function ({
  filter,
  page,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    return await fetchHtv("", filter, page, signal, providerContext);
  } catch (e) {
    return [];
  }
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    return await fetchHtv(searchQuery, "", page, signal, providerContext);
  } catch (e) {
    return [];
  }
};

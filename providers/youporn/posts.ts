import { Post, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://www.you-porn.com";

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
    const targetUrl =
      currentPage > 1
        ? (filter.includes("?") ? `${baseUrl}${filter}&page=${currentPage}` : `${baseUrl}${filter}?page=${currentPage}`)
        : `${baseUrl}${filter}`;

    const res = await providerContext.axios.get(targetUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1;",
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $("div.video-box, div[data-video-id], .four-column-video-box, .video-thumb").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/watch/']").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find(".video-title, .video_title").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-original") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const hdTag = $el.find(".hd-badge, .hd").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: hdTag || undefined,
      });
    });
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
    const searchUrl = `${baseUrl}/search/?query=${encodeURIComponent(searchQuery)}&page=${currentPage}`;

    const res = await providerContext.axios.get(searchUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1;",
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $("div.video-box, div[data-video-id], .four-column-video-box, .video-thumb").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/watch/']").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find(".video-title, .video_title").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-original") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const hdTag = $el.find(".hd-badge, .hd").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: hdTag || undefined,
      });
    });
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getSearchPosts error:`, err.message || err);
  }
  return posts;
};

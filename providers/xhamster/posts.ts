import { Post, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://xhamster.com";

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
        ? `${baseUrl}${filter}/${currentPage}`
        : `${baseUrl}${filter}`;

    const res = await providerContext.axios.get(targetUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $("article[data-video-id], .thumb-list__item, .video-thumb").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/videos/']").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find(".video-thumb-info__name").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".thumb-image-container__duration, [data-role='video-duration']").text().trim();
      const hdTag = $el.find(".badge--hd, .badge--4k, .video-thumb-views").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink}`;

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
    const searchUrl = `${baseUrl}/search/${encodeURIComponent(searchQuery)}?page=${currentPage}`;

    const res = await providerContext.axios.get(searchUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $("article[data-video-id], .thumb-list__item, .video-thumb").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/videos/']").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find(".video-thumb-info__name").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".thumb-image-container__duration, [data-role='video-duration']").text().trim();
      const hdTag = $el.find(".badge--hd, .badge--4k, .video-thumb-views").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink}`;

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

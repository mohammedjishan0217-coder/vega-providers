import { Post, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://www.pornhub.org";

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
    let targetUrl: string;

    if (currentPage > 1) {
      targetUrl = filter.includes("?")
        ? `${baseUrl}${filter}&page=${currentPage}`
        : `${baseUrl}${filter}?page=${currentPage}`;
    } else {
      targetUrl = `${baseUrl}${filter}`;
    }

    const res = await providerContext.axios.get(targetUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1; platform=pc;",
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $(".pcVideoListItem, .videoblock, ul#videoCategory li").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/view_video.php?viewkey=']").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find(".title a").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-thumb_url") ||
        $el.find("img").attr("data-mediumthumb") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const views = $el.find(".views").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: views || undefined,
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
    const searchUrl =
      currentPage > 1
        ? `${baseUrl}/video/search?search=${encodeURIComponent(searchQuery)}&page=${currentPage}`
        : `${baseUrl}/video/search?search=${encodeURIComponent(searchQuery)}`;

    const res = await providerContext.axios.get(searchUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1; platform=pc;",
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $(".pcVideoListItem, .videoblock, ul#videoCategory li").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/view_video.php?viewkey=']").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find(".title a").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-thumb_url") ||
        $el.find("img").attr("data-mediumthumb") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const views = $el.find(".views").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: views || undefined,
      });
    });
  } catch (err: any) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getSearchPosts error:`, err.message || err);
  }
  return posts;
};

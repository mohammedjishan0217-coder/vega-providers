import { Post, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://www.xnxx.com";

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
        ? `${baseUrl}${filter}/${currentPage - 1}`
        : `${baseUrl}${filter}`;

    const res = await providerContext.axios.get(targetUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Referer: baseUrl,
      },
      signal,
    });

    const html: string = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const $ = providerContext.cheerio.load(html);

    // 1. Scrape standard mozaique thumb blocks
    $("div.mozaique div.thumb-block").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find(".thumb-inside .thumb a").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink || rawLink.startsWith("javascript:")) return;

      const title =
        $el.find("p.title a").attr("title") ||
        $el.find("p.title a").text().trim() ||
        $el.find(".thumb-inside p a").text().trim() ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const hdTag = $el.find(".metadata .bg").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: hdTag || undefined,
      });
    });

    // 2. Fallback: Parse inline script xv.cats.write_thumb_block_list
    if (posts.length === 0) {
      const match = html.match(/xv\.cats\.write_thumb_block_list\((.*?)\);/s);
      if (match && match[1]) {
        try {
          const list = JSON.parse(match[1]);
          if (Array.isArray(list)) {
            for (const item of list) {
              const u = item.u || "";
              const t = item.tf || item.t || "Untitled Video";
              const i = item.i || "";
              if (u) {
                posts.push({
                  title: t,
                  link: u.startsWith("http") ? u : `${baseUrl}${u}`,
                  image: i,
                });
              }
            }
          }
        } catch (e) {}
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
    const searchUrl = `${baseUrl}/search/${encodeURIComponent(searchQuery)}/${currentPage - 1}`;

    const res = await providerContext.axios.get(searchUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $("div.mozaique div.thumb-block").each((_: number, el: any) => {
      const $el = $(el);
      const linkEl = $el.find(".thumb-inside .thumb a").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink || rawLink.startsWith("javascript:")) return;

      const title =
        $el.find("p.title a").attr("title") ||
        $el.find("p.title a").text().trim() ||
        $el.find(".thumb-inside p a").text().trim() ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const hdTag = $el.find(".metadata .bg").text().trim();

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

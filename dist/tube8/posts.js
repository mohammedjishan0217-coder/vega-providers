"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchPosts = exports.getPosts = void 0;

const DEFAULT_BASE_URL = "https://www.tube8.es";

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

    $(".video_box, .thumb-block, li[data-video-id], div.video-item, .video-thumb").each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/video/'], a.thumb, a.title").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink || rawLink.startsWith("javascript:")) return;

      const title =
        linkEl.attr("title") ||
        $el.find("a.title").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-thumb_url") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const hdTag = $el.find(".hd, .quality").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: hdTag || undefined,
      });
    });
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
    const searchUrl = `${baseUrl}/searches.html?q=${encodeURIComponent(searchQuery)}&page=${currentPage}`;

    const res = await providerContext.axios.get(searchUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1;",
        Referer: baseUrl,
      },
      signal,
    });

    const $ = providerContext.cheerio.load(res.data);

    $(".video_box, .thumb-block, li[data-video-id], div.video-item, .video-thumb").each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find("a[href*='/video/'], a.thumb, a.title").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink || rawLink.startsWith("javascript:")) return;

      const title =
        linkEl.attr("title") ||
        $el.find("a.title").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("data-thumb_url") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find(".duration").text().trim();
      const hdTag = $el.find(".hd, .quality").text().trim();

      const link = rawLink.startsWith("http") ? rawLink : `${baseUrl}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`;

      posts.push({
        title: title.trim(),
        link,
        image,
        tag: duration || undefined,
        cornerTag: hdTag || undefined,
      });
    });
  } catch (err) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error(`[${providerValue}] getSearchPosts error:`, err.message || err);
  }
  return posts;
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchPosts = exports.getPosts = void 0;

const DEFAULT_BASE_URL = "https://spankbang.com";

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
    const targetUrl = `${baseUrl}${filter}/${currentPage}/`;

    let html = "";
    try {
      const res = await providerContext.axios.get(targetUrl, {
        headers: {
          ...providerContext.commonHeaders,
          Referer: baseUrl,
        },
        signal,
      });
      html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch (fetchErr) {
      if (fetchErr.response?.status === 403 && providerContext.openWebView) {
        const wv = await providerContext.openWebView(targetUrl, {
          title: "SpankBang Security Verification",
          waitForCookie: "cf_clearance",
          timeoutMs: 60000,
        });
        html = wv?.data || "";
      } else {
        throw fetchErr;
      }
    }

    const $ = providerContext.cheerio.load(html);

    $("div.video-item, div.video-list .item, .video_item").each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find("a.n, a[href*='/video/'], a.thumb").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find("a.n").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img.cover").attr("data-src") ||
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find("span.l, .duration").text().trim();
      const hdTag = $el.find("span.hd, span.uhd, .quality").text().trim();

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
    const searchUrl = `${baseUrl}/s/${encodeURIComponent(searchQuery)}/${currentPage}/`;

    let html = "";
    try {
      const res = await providerContext.axios.get(searchUrl, {
        headers: {
          ...providerContext.commonHeaders,
          Referer: baseUrl,
        },
        signal,
      });
      html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch (fetchErr) {
      if (fetchErr.response?.status === 403 && providerContext.openWebView) {
        const wv = await providerContext.openWebView(searchUrl, {
          title: "SpankBang Security Verification",
          waitForCookie: "cf_clearance",
          timeoutMs: 60000,
        });
        html = wv?.data || "";
      } else {
        throw fetchErr;
      }
    }

    const $ = providerContext.cheerio.load(html);

    $("div.video-item, div.video-list .item, .video_item").each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find("a.n, a[href*='/video/'], a.thumb").first();
      const rawLink = linkEl.attr("href");
      if (!rawLink) return;

      const title =
        linkEl.attr("title") ||
        $el.find("a.n").text().trim() ||
        $el.find("img").attr("alt") ||
        "Untitled Video";

      const image =
        $el.find("img.cover").attr("data-src") ||
        $el.find("img").attr("data-src") ||
        $el.find("img").attr("src") ||
        "";

      const duration = $el.find("span.l, .duration").text().trim();
      const hdTag = $el.find("span.hd, span.uhd, .quality").text().trim();

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

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSearchPosts = exports.getPosts = void 0;
const DEFAULT_BASE_URL = "https://hanime.tv";
const SEARCH_API_URL = "https://search.htv-services.com/";
async function resolveBaseUrl(providerContext) {
  const custom = await providerContext.kvStore?.get("baseUrlOverride");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}
function parseHitToPost(baseUrl, item) {
  if (!item) return null;
  const slug = item.slug || "";
  const title = (item.name || item.title || "").trim();
  const image = item.cover_url || item.poster_url || "";
  if (!slug || !title) return null;
  return {
    title,
    link: `${baseUrl}/videos/hentai/${slug}`,
    image: image.startsWith("//") ? `https:${image}` : image
  };
}
async function fetchFromSearchApi({
  axios,
  commonHeaders,
  baseUrl,
  searchText,
  tags,
  orderBy,
  ordering,
  page,
  signal
}) {
  const apiPage = Math.max(0, (page || 1) - 1);
  const payload = {
    search_text: searchText || "",
    tags: tags || [],
    tags_mode: "AND",
    brands: [],
    blacklist: [],
    order_by: orderBy || "created_at_unix",
    ordering: ordering || "desc",
    page: apiPage
  };
  const res = await axios.post(SEARCH_API_URL, payload, {
    headers: {
      ...commonHeaders,
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
      Origin: baseUrl,
      Referer: `${baseUrl}/`
    },
    signal
  });
  const data = res?.data;
  if (!data) return [];
  let hits = [];
  if (typeof data.hits === "string") {
    try {
      hits = JSON.parse(data.hits);
    } catch {
      hits = [];
    }
  } else if (Array.isArray(data.hits)) {
    hits = data.hits;
  } else if (Array.isArray(data.hentai_videos)) {
    hits = data.hentai_videos;
  }
  const posts = [];
  for (const item of hits) {
    const post = parseHitToPost(baseUrl, item);
    if (post) posts.push(post);
  }
  return posts;
}
const getPosts = async function ({
  filter,
  page,
  providerValue,
  signal,
  providerContext
}) {
  try {
    const {
      axios,
      cheerio,
      commonHeaders
    } = providerContext;
    const baseUrl = await resolveBaseUrl(providerContext);
    const apiPage = Math.max(0, (page || 1) - 1);
    if (filter && filter.startsWith("trending:")) {
      const time = filter.split(":")[1] || "month";
      try {
        const trendUrl = `${baseUrl}/api/v8/browse-trending?time=${encodeURIComponent(time)}&page=${apiPage}`;
        const res = await axios.get(trendUrl, {
          headers: {
            ...commonHeaders,
            Accept: "application/json, text/plain, */*",
            Referer: `${baseUrl}/browse/trending`,
            "X-Signature-Version": "web2"
          },
          signal
        });
        const videos = res?.data?.hentai_videos;
        if (Array.isArray(videos) && videos.length > 0) {
          const posts = [];
          for (const v of videos) {
            const post = parseHitToPost(baseUrl, v);
            if (post) posts.push(post);
          }
          if (posts.length > 0) return posts;
        }
      } catch {}
      return await fetchFromSearchApi({
        axios,
        commonHeaders,
        baseUrl,
        searchText: "",
        tags: [],
        orderBy: "views",
        ordering: "desc",
        page,
        signal
      });
    }
    if (filter && filter.startsWith("tag:")) {
      const tag = filter.slice(4).trim();
      return await fetchFromSearchApi({
        axios,
        commonHeaders,
        baseUrl,
        searchText: "",
        tags: tag ? [tag] : [],
        orderBy: "created_at_unix",
        ordering: "desc",
        page,
        signal
      });
    }
    let orderBy = "created_at_unix";
    let ordering = "desc";
    if (filter && filter.includes("order_by=")) {
      const params = new URLSearchParams(filter);
      orderBy = params.get("order_by") || "created_at_unix";
      ordering = params.get("ordering") || "desc";
    }
    const searchPosts = await fetchFromSearchApi({
      axios,
      commonHeaders,
      baseUrl,
      searchText: "",
      tags: [],
      orderBy,
      ordering,
      page,
      signal
    });
    if (searchPosts.length > 0) {
      return searchPosts;
    }
    const landingRes = await axios.get(`${baseUrl}/api/v8/landing`, {
      headers: {
        ...commonHeaders,
        Accept: "application/json, text/plain, */*",
        Referer: `${baseUrl}/`
      },
      signal
    });
    const landingVideos = landingRes?.data?.hentai_videos;
    if (Array.isArray(landingVideos) && landingVideos.length > 0) {
      const posts = [];
      for (const v of landingVideos) {
        const post = parseHitToPost(baseUrl, v);
        if (post) posts.push(post);
      }
      return posts;
    }
    const htmlRes = await axios.get(baseUrl, {
      headers: commonHeaders,
      signal
    });
    const $ = cheerio.load(htmlRes.data || "");
    const htmlPosts = [];
    $("a[href*='/videos/hentai/']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const title = $(el).attr("title")?.trim() || $(el).find(".card-mobile-title, .title, h2, h3").first().text().trim() || $(el).text().trim();
      const img = $(el).find("img").first().attr("data-src") || $(el).find("img").first().attr("src") || "";
      if (href && title) {
        const fullLink = href.startsWith("http") ? href : `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
        if (!htmlPosts.some(p => p.link === fullLink)) {
          htmlPosts.push({
            title,
            link: fullLink,
            image: img.startsWith("//") ? `https:${img}` : img
          });
        }
      }
    });
    return htmlPosts;
  } catch (error) {
    console.error("hanime getPosts error:", error);
    return [];
  }
};
exports.getPosts = getPosts;
const getSearchPosts = async function ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext
}) {
  try {
    const {
      axios,
      commonHeaders
    } = providerContext;
    const baseUrl = await resolveBaseUrl(providerContext);
    return await fetchFromSearchApi({
      axios,
      commonHeaders,
      baseUrl,
      searchText: (searchQuery || "").trim(),
      tags: [],
      orderBy: "views",
      ordering: "desc",
      page,
      signal
    });
  } catch (error) {
    console.error("hanime getSearchPosts error:", error);
    return [];
  }
};
exports.getSearchPosts = getSearchPosts;

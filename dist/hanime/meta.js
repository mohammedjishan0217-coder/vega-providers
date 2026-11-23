"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeta = void 0;

const DEFAULT_BASE_URL = "https://hanime.tv";

async function resolveBaseUrl(providerContext) {
  try {
    const override = await providerContext.kvStore?.get("baseUrlOverride");
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

function extractSlug(link) {
  try {
    const clean = link.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

exports.getMeta = async function ({ link, providerContext }) {
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const slug = extractSlug(link);
    const targetUrl = link.startsWith("http")
      ? link
      : `${baseUrl}${link.startsWith("/") ? "" : "/"}${link}`;

    const res = await providerContext.axios.get(targetUrl, {
      headers: {
        ...providerContext.commonHeaders,
        Referer: baseUrl,
      },
    });

    const $ = providerContext.cheerio.load(res.data);

    let title =
      $("meta[property='og:title']").attr("content") ||
      $("h1").first().text().trim();
    title = title
      .replace(/\s*-\s*hanime\.tv\s*$/i, "")
      .replace(/^Watch\s+/i, "")
      .replace(/\s+Hentai Video.*$/i, "")
      .trim();
    if (!title) title = slug.replace(/-/g, " ");

    const synopsis =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      $(".description, .synopsis, p").first().text().trim() ||
      "";

    const image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content") ||
      $("img[src*='covers'], img[src*='posters']").first().attr("src") ||
      "";

    const franchiseLinks = [];
    const seenLinks = new Set();

    $("a[href^='/videos/hentai/']").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const fullHref = href.startsWith("http") ? href : `${baseUrl}${href}`;
      if (seenLinks.has(fullHref)) return;
      seenLinks.add(fullHref);

      const rawTitle =
        $(el).find("h3, .title, span").first().text().trim() ||
        $(el).attr("title") ||
        "";

      let cleanTitle = rawTitle
        .replace(/^Now Playing\s*/i, "")
        .replace(/^\d+:\d+\s+/, "");
      cleanTitle = cleanTitle.split(/\s+(?:[0-9\.]+[MK]?\s+views|·)/)[0].trim();
      cleanTitle = cleanTitle.replace(/\s+[A-Z][a-zA-Z0-9_\-]+$/, "").trim();
      if (!cleanTitle || cleanTitle.length < 2) {
        cleanTitle = href.split("/").pop()?.replace(/-/g, " ") || "Episode";
      }

      franchiseLinks.push({
        title: cleanTitle,
        link: fullHref,
        type: "series",
      });
    });

    franchiseLinks.sort((a, b) => {
      const numA = parseInt((a.link.match(/(\d+)$/) || [])[1] || "0", 10);
      const numB = parseInt((b.link.match(/(\d+)$/) || [])[1] || "0", 10);
      if (numA && numB) return numA - numB;
      return a.title.localeCompare(b.title);
    });

    const isSeries = franchiseLinks.length > 1;
    const linkList = [];

    if (isSeries) {
      linkList.push({
        title: "Episodes / Franchise",
        directLinks: franchiseLinks,
      });
    } else {
      linkList.push({
        title: "Full Video",
        directLinks: [
          {
            title: title || "Play Video",
            link: targetUrl,
            type: "movie",
          },
        ],
      });
    }

    return {
      title,
      synopsis,
      image,
      imdbId: slug || "hanime",
      type: isSeries ? "series" : "movie",
      linkList,
    };
  } catch (err) {
    console.error("[hanime] getMeta error:", err.message || err);
    return {
      title: "Error Loading Metadata",
      synopsis: "",
      image: "",
      imdbId: "hanime",
      type: "movie",
      linkList: [],
    };
  }
};

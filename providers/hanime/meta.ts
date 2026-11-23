import { Info, Link, ProviderContext } from "../types";

const DEFAULT_BASE_URL = "https://hanime.tv";

async function resolveBaseUrl(providerContext: ProviderContext): Promise<string> {
  try {
    const override = await providerContext.kvStore?.get<string>("baseUrlOverride");
    if (override && override.trim().length > 0) {
      return override.trim().replace(/\/+$/, "");
    }
  } catch (e) {}
  return DEFAULT_BASE_URL;
}

function extractSlug(link: string): string {
  try {
    const clean = link.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
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

    // Extract related franchise / series episode links on the page
    const franchiseLinks: { title: string; link: string; type?: "movie" | "series" }[] = [];
    const seenLinks = new Set<string>();

    $("a[href^='/videos/hentai/']").each((_: number, el: any) => {
      const href = $(el).attr("href");
      if (!href) return;
      const fullHref = href.startsWith("http") ? href : `${baseUrl}${href}`;
      if (seenLinks.has(fullHref)) return;
      seenLinks.add(fullHref);

      const epTitle =
        $(el).find("h3, .title, span").first().text().trim() ||
        $(el).attr("title") ||
        "";
      if (epTitle) {
        franchiseLinks.push({
          title: epTitle.replace(/^Watch\s+/i, "").trim(),
          link: fullHref,
          type: "series",
        });
      }
    });

    const isSeries = franchiseLinks.length > 1;
    const linkList: Link[] = [];

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
  } catch (err: any) {
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

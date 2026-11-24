"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeta = void 0;

exports.getMeta = async function ({ link, providerContext }) {
  try {
    const res = await providerContext.axios.get(link, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1;",
      },
    });

    const $ = providerContext.cheerio.load(res.data);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().replace("- YouPorn", "").trim() ||
      "Video Details";

    const synopsis =
      $("meta[property='og:description']").attr("content") ||
      "";

    const image =
      $("meta[property='og:image']").attr("content") ||
      "";

    const tags = [];
    $("a.video-tag, .tags-list a, .categories-list a").each((_, el) => {
      const tagText = $(el).text().trim();
      if (tagText && !tags.includes(tagText)) tags.push(tagText);
    });

    return {
      title,
      synopsis,
      image,
      imdbId: "",
      type: "movie",
      tags: tags.length > 0 ? tags : undefined,
      linkList: [
        {
          title: "Full Video",
          directLinks: [
            {
              title: "Play Video",
              link,
              type: "movie",
            },
          ],
        },
      ],
    };
  } catch (err) {
    console.error("youporn getMeta error:", err.message || err);
    return {
      title: "Video Details",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "movie",
      linkList: [
        {
          title: "Full Video",
          directLinks: [
            {
              title: "Play Video",
              link,
              type: "movie",
            },
          ],
        },
      ],
    };
  }
};

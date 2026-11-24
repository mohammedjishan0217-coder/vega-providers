import { Info, ProviderContext } from "../types";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const res = await providerContext.axios.get(link, {
      headers: {
        ...providerContext.commonHeaders,
        Cookie: "age_verified=1; platform=pc;",
      },
    });

    const $ = providerContext.cheerio.load(res.data);

    const title =
      $("h1.title span.inlineFree").text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      $("title").text().replace("- Pornhub.com", "").trim() ||
      "Video Details";

    const synopsis =
      $("meta[property='og:description']").attr("content") ||
      $(".video-description").text().trim() ||
      "";

    const image =
      $("meta[property='og:image']").attr("content") ||
      $(".videoWrapper img").attr("src") ||
      "";

    const tags: string[] = [];
    $(".tagsWrapper a, .categoriesWrapper a").each((_: number, el: any) => {
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
  } catch (err: any) {
    console.error("pornhub getMeta error:", err.message || err);
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

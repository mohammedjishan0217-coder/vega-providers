import { Info, ProviderContext } from "../types";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    let html = "";
    try {
      const res = await providerContext.axios.get(link, {
        headers: providerContext.commonHeaders,
      });
      html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch (fetchErr: any) {
      if (fetchErr.response?.status === 403 && providerContext.openWebView) {
        const wv = await providerContext.openWebView(link, {
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

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("h1").first().text().trim() ||
      $("title").text().replace("- SpankBang", "").trim() ||
      "Video Details";

    const synopsis =
      $("meta[property='og:description']").attr("content") ||
      $(".info .desc").text().trim() ||
      "";

    const image =
      $("meta[property='og:image']").attr("content") ||
      "";

    const tags: string[] = [];
    $("a.cat, .categories a, .tags a").each((_: number, el: any) => {
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
    console.error("spankbang getMeta error:", err.message || err);
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

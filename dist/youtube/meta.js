"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeta = void 0;

function extractVideoId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return url;
}

exports.getMeta = async function ({
  link,
  providerContext
}) {
  const { axios, commonHeaders } = providerContext;
  const videoId = extractVideoId(link);

  let title = "YouTube Video";
  let synopsis = "";
  const image = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let author = "YouTube";

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`;
    const res = await axios.get(watchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...commonHeaders
      }
    });

    const html = typeof res.data === "string" ? res.data : "";
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1].replace(/ - YouTube$/, "").trim();
    }

    const descMatch = html.match(/\"description\":\{\"simpleText\":\"([^\"]+)\"\}/);
    if (descMatch) {
      synopsis = descMatch[1].replace(/\\n/g, "\n");
    }

    const authorMatch = html.match(/\"author\":\"([^\"]+)\"/);
    if (authorMatch) {
      author = authorMatch[1];
    }
  } catch (err) {
    title = `YouTube Video (${videoId})`;
  }

  return {
    title,
    synopsis,
    image,
    imdbId: "",
    type: "movie",
    cast: [author],
    tags: ["YouTube", "Video"],
    linkList: [
      {
        title: "Streams & Downloads",
        directLinks: [
          {
            title: "Play / Download",
            link: `https://www.youtube.com/watch?v=${videoId}`,
            type: "movie"
          }
        ]
      }
    ]
  };
};

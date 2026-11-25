"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchPosts = exports.getPosts = void 0;

const SEARCH_API = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";

const INNERTUBE_CLIENT = {
  clientName: "WEB",
  clientVersion: "2.20240313.01.00",
  hl: "en",
  gl: "US"
};

function extractVideos(data) {
  const posts = [];
  const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

  for (const s of sections) {
    const contents = s?.itemSectionRenderer?.contents || [];
    for (const c of contents) {
      const vr = c?.videoRenderer;
      if (vr && vr.videoId) {
        const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "YouTube Video";
        const videoId = vr.videoId;
        const thumbnails = vr.thumbnail?.thumbnails || [];
        const image = thumbnails.length > 0
          ? thumbnails[thumbnails.length - 1].url
          : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const channel = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "";
        const duration = vr.lengthText?.simpleText || "";
        const tag = duration ? (channel ? `${channel} • ${duration}` : duration) : channel;

        posts.push({
          title,
          link: `https://www.youtube.com/watch?v=${videoId}`,
          image,
          tag
        });
      }
    }
  }
  return posts;
}

exports.getPosts = async function ({
  filter,
  page,
  providerValue,
  signal,
  providerContext
}) {
  const { axios, commonHeaders } = providerContext;
  const query = filter || "trending";

  try {
    const payload = {
      context: { client: INNERTUBE_CLIENT },
      query
    };

    const res = await axios.post(SEARCH_API, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...commonHeaders
      },
      signal
    });

    return extractVideos(res.data);
  } catch (err) {
    return [];
  }
};

exports.getSearchPosts = async function ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext
}) {
  const { axios, commonHeaders } = providerContext;
  const trimmed = searchQuery.trim();

  let directId = null;
  const idMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (idMatch) {
    directId = idMatch[1];
  } else if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    directId = trimmed;
  }

  if (directId) {
    return [
      {
        title: `YouTube Video (${directId})`,
        link: `https://www.youtube.com/watch?v=${directId}`,
        image: `https://i.ytimg.com/vi/${directId}/maxresdefault.jpg`
      }
    ];
  }

  try {
    const payload = {
      context: { client: INNERTUBE_CLIENT },
      query: trimmed
    };

    const res = await axios.post(SEARCH_API, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...commonHeaders
      },
      signal
    });

    return extractVideos(res.data);
  } catch (err) {
    return [];
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStream = void 0;

const DEFAULT_BASE_URL = "https://anifam.net";

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

function parseEpisodeParams(link) {
  let episodeId = "";
  let track = "sub";

  const match = link.match(/\/episodes\/(\d+)\/play(?:\?track=([^&]+))?/i);
  if (match) {
    episodeId = match[1];
    if (match[2]) track = match[2];
  } else {
    const matchSimple = link.match(/(\d+)/);
    if (matchSimple) episodeId = matchSimple[1];
    const matchTrack = link.match(/[?&]track=([^&]+)/i);
    if (matchTrack) track = matchTrack[1];
  }

  return { episodeId, track };
}

function formatSubtitles(subs) {
  if (!Array.isArray(subs)) return [];
  const result = [];
  for (const s of subs) {
    if (s && s.url) {
      result.push({
        title: s.label || s.lang || "Subtitles",
        language: s.lang || "en",
        type: "text/vtt",
        uri: s.url,
      });
    }
  }
  return result;
}

exports.getStream = async function ({
  link,
  type,
  signal,
  providerContext,
  isDownload,
}) {
  const streams = [];
  try {
    const baseUrl = await resolveBaseUrl(providerContext);
    const { episodeId, track } = parseEpisodeParams(link);

    if (!episodeId) {
      console.error("[anifam] getStream error: No valid episodeId found in link:", link);
      return streams;
    }

    // Read user settings
    const preferredServer = await providerContext.kvStore?.get("preferredServer");

    // 1. Fetch playback payload
    const playRes = await providerContext.axios.post(
      `${baseUrl}/api/v1/app/episodes/${episodeId}/play`,
      { track },
      {
        headers: {
          ...providerContext.commonHeaders,
          "Content-Type": "application/json",
          Accept: "application/json",
          Referer: baseUrl,
        },
        signal,
      }
    );

    const sources = playRes?.data?.sources;
    if (!Array.isArray(sources) || sources.length === 0) {
      return streams;
    }

    const resolvableSources = [];

    for (const src of sources) {
      if (!src) continue;

      if (src.kind === "hls" && src.url) {
        streams.push({
          server: `${src.server || "AniFam"} [${track.toUpperCase()}]`,
          link: src.url,
          type: "m3u8",
          headers: src.media_headers || {
            Referer: "https://zokoanime.video/",
          },
          subtitles: formatSubtitles(src.subtitles),
        });
      } else if (src.resolvable && src.server_id) {
        resolvableSources.push(src);
      } else if (src.url) {
        // Direct or embed fallback
        streams.push({
          server: `${src.server || "Server"} [${track.toUpperCase()}]`,
          link: src.url,
          type: src.url.includes(".m3u8") ? "m3u8" : "mp4",
          headers: src.media_headers || { Referer: baseUrl },
          subtitles: formatSubtitles(src.subtitles),
        });
      }
    }

    // 2. Resolve resolvable sources in parallel
    if (resolvableSources.length > 0) {
      const resolveResults = await Promise.allSettled(
        resolvableSources.map(async (src) => {
          const rRes = await providerContext.axios.post(
            `${baseUrl}/api/v1/app/episodes/${episodeId}/resolve`,
            { server_id: src.server_id, track },
            {
              headers: {
                ...providerContext.commonHeaders,
                "Content-Type": "application/json",
                Accept: "application/json",
                Referer: baseUrl,
              },
              signal,
            }
          );
          return { src, data: rRes?.data };
        })
      );

      for (const res of resolveResults) {
        if (res.status === "fulfilled" && res.value?.data?.url) {
          const rData = res.value.data;
          const originalSrc = res.value.src;
          streams.push({
            server: `${rData.server || originalSrc.server || "Server"} [${track.toUpperCase()}]`,
            link: rData.url,
            type: "m3u8",
            headers: rData.media_headers || {
              Referer: "https://megaplay.buzz/",
              Origin: "https://megaplay.buzz",
            },
            subtitles: formatSubtitles(rData.subtitles || originalSrc.subtitles),
          });
        }
      }
    }

    // 3. Sort streams:
    // If preferredServer matches, bring to top.
    // If isDownload, direct HLS streams suitable for saving are placed first.
    streams.sort((a, b) => {
      if (preferredServer) {
        const aMatchesPref = a.server.toLowerCase().includes(preferredServer.toLowerCase());
        const bMatchesPref = b.server.toLowerCase().includes(preferredServer.toLowerCase());
        if (aMatchesPref !== bMatchesPref) {
          return aMatchesPref ? -1 : 1;
        }
      }

      if (isDownload) {
        const aIsAniFam = a.server.includes("AniFam") || a.server.includes("HD-1");
        const bIsAniFam = b.server.includes("AniFam") || b.server.includes("HD-1");
        if (aIsAniFam !== bIsAniFam) {
          return aIsAniFam ? -1 : 1;
        }
      }

      return 0;
    });
  } catch (err) {
    if (err.name === "CanceledError" || err.name === "AbortError") throw err;
    console.error("[anifam] getStream error:", err.message || err);
  }
  return streams;
};

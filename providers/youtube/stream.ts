import { Stream, ProviderContext, TextTrack } from "../types";

function extractVideoId(url: string): string {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return url;
}

export const getStream = async function ({
  link,
  type,
  signal,
  providerContext,
  isDownload
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const { axios, commonHeaders } = providerContext;
  const videoId = extractVideoId(link);

  let visitorData: string | null = null;
  let sts = 20779;

  // Step 1: Fetch watch page for visitorData and sts
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`;
    const watchRes = await axios.get(watchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...commonHeaders
      },
      signal
    });

    const html: string = typeof watchRes.data === "string" ? watchRes.data : "";
    const vMatch = html.match(/\"VISITOR_DATA\":\"([^\"]+)\"/);
    if (vMatch) visitorData = vMatch[1];
    const sMatch = html.match(/\"sts\":(\d+)/i) || html.match(/\"signatureTimestamp\":(\d+)/i);
    if (sMatch) sts = parseInt(sMatch[1], 10);
  } catch (e) {
    // Proceed with defaults
  }

  // Step 2: Request VISIONOS client
  const clientPayload = {
    context: {
      client: {
        clientName: "VISIONOS",
        clientVersion: "1.02",
        deviceMake: "Apple",
        deviceModel: "RealityDevice17,1",
        osName: "visionOS",
        osVersion: "26.5.23O471",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0
      }
    },
    videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: "HTML5_PREF_WANTS",
        signatureTimestamp: sts
      }
    },
    contentCheckOk: true,
    racyCheckOk: true
  };

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    "X-YouTube-Client-Name": "101",
    "X-YouTube-Client-Version": "1.02",
    "Origin": "https://www.youtube.com"
  };
  if (visitorData) reqHeaders["X-Goog-Visitor-Id"] = visitorData;

  let playerRes: any = null;
  try {
    const res = await axios.post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", clientPayload, {
      headers: reqHeaders,
      signal
    });
    playerRes = res.data;
  } catch (err) {
    playerRes = null;
  }

  // Fallback to ANDROID_VR if needed
  if (!playerRes?.streamingData || (!playerRes.streamingData.formats && !playerRes.streamingData.adaptiveFormats)) {
    try {
      const androidPayload = {
        context: {
          client: {
            clientName: "ANDROID_VR",
            clientVersion: "1.60.19",
            hl: "en",
            gl: "US"
          }
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
      };
      const res = await axios.post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", androidPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://www.youtube.com"
        },
        signal
      });
      playerRes = res.data;
    } catch (e) {
      // Ignore
    }
  }

  if (!playerRes?.streamingData) return [];

  // Extract subtitles
  const subtitles: TextTrack[] = [];
  const captionTracks = playerRes.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  for (const track of captionTracks) {
    if (track.baseUrl) {
      const langName = track.name?.runs?.[0]?.text || track.name?.simpleText || track.languageCode;
      subtitles.push({
        title: langName,
        language: track.languageCode || "en",
        type: "text/vtt",
        uri: `${track.baseUrl}&fmt=vtt`
      });
    }
  }

  const streams: Stream[] = [];
  const formats = playerRes.streamingData.formats || [];
  const adaptiveFormats = playerRes.streamingData.adaptiveFormats || [];

  // 1. Combined audio+video formats (pre-muxed, instant playback and simple downloading)
  for (const f of formats) {
    if (f.url && !(f.cipher || f.signatureCipher)) {
      const q = f.qualityLabel || f.quality || "360p";
      const qNum = parseInt(q.replace(/\D/g, ""), 10) || 360;
      streams.push({
        server: `YouTube Direct (${q} Audio+Video)`,
        link: f.url,
        type: "mp4",
        quality: qNum.toString(),
        subtitles: subtitles.length > 0 ? subtitles : undefined
      });
    }
  }

  // 2. High Quality Adaptive Video Formats (4K, 1440p, 1080p, 720p, 480p, 360p)
  const seenQualities = new Set<string>();
  for (const f of adaptiveFormats) {
    if (f.url && !(f.cipher || f.signatureCipher) && f.mimeType?.startsWith("video/")) {
      const qLabel = f.qualityLabel || `${f.height}p` || "video";
      const qNum = f.height || parseInt(qLabel.replace(/\D/g, ""), 10) || 720;
      const isMp4 = f.mimeType?.includes("mp4");
      const ext = isMp4 ? "mp4" : "mkv";
      const formatKey = `${qLabel}-${isMp4 ? "mp4" : "webm"}`;

      if (!seenQualities.has(formatKey)) {
        seenQualities.add(formatKey);
        streams.push({
          server: `YouTube ${qLabel} (${isMp4 ? "MP4" : "WebM"})`,
          link: f.url,
          type: ext,
          quality: qNum.toString(),
          subtitles: subtitles.length > 0 ? subtitles : undefined
        });
      }
    }
  }

  // 3. Audio Formats (AAC 128k / Opus)
  for (const f of adaptiveFormats) {
    if (f.url && !(f.cipher || f.signatureCipher) && f.mimeType?.startsWith("audio/")) {
      const isAac = f.mimeType?.includes("mp4");
      const codecName = isAac ? "AAC (m4a)" : "Opus (webm)";
      streams.push({
        server: `YouTube Audio Only (${codecName})`,
        link: f.url,
        type: isAac ? "mp4" : "mkv",
        quality: "Audio",
        subtitles: subtitles.length > 0 ? subtitles : undefined
      });
    }
  }

  // Sorting
  if (isDownload) {
    streams.sort((a, b) => {
      const aCombined = a.server.includes("Audio+Video");
      const bCombined = b.server.includes("Audio+Video");
      if (aCombined && !bCombined) return -1;
      if (!aCombined && bCombined) return 1;
      const aQ = parseInt(a.quality || "0", 10) || 0;
      const bQ = parseInt(b.quality || "0", 10) || 0;
      return bQ - aQ;
    });
  } else {
    streams.sort((a, b) => {
      const aQ = parseInt(a.quality || "0", 10) || 0;
      const bQ = parseInt(b.quality || "0", 10) || 0;
      return bQ - aQ;
    });
  }

  return streams;
};

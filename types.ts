export interface Post {
  title: string;
  link: string;
  image: string;
  provider?: string;
}

export interface DirectLink {
  title: string;
  link: string;
  type?: "movie" | "series";
  quality?: string;
}

export interface LinkGroup {
  title: string;
  quality?: string;
  episodesLink?: string;
  directLinks?: DirectLink[];
}

export interface Info {
  title: string;
  synopsis: string;
  image: string;
  imdbId: string;
  type: "movie" | "series";
  tags?: string[];
  cast?: string[];
  rating?: string;
  linkList: LinkGroup[];
}

export interface EpisodeLink {
  title: string;
  link: string;
}

export interface TextTrack {
  title: string;
  language: string;
  type: "application/x-subrip" | "text/vtt" | "application/ttml+xml";
  uri: string;
}

export interface StreamDrm {
  type: "clearkey" | "widevine" | "playready" | "fairplay";
  clearKeys?: Record<string, string>;
  licenseServer?: string;
  headers?: Record<string, string>;
  multiDrm?: boolean;
  contentId?: string;
  certificateUrl?: string;
  base64Certificate?: string;
}

export interface Stream {
  server: string;
  link: string;
  type: "m3u8" | "mp4" | "mkv" | "mpd";
  quality?: "360" | "480" | "720" | "1080" | "2160" | string;
  headers?: Record<string, string>;
  subtitles?: TextTrack[];
  drm?: StreamDrm;
}

export interface SettingsField {
  key: string;
  type: "select" | "multiselect" | "toggle" | "text" | "number";
  label: string;
  description?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string | string[] | boolean | number;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface ProviderKvStore {
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
  keys: () => Promise<string[]>;
  clear: () => Promise<void>;
}

export interface WebViewOptions {
  title?: string;
  waitForCookie?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  injectedJavaScript?: string;
}

export interface WebViewResult {
  data: any;
  cookies: string;
  cookieMap: Record<string, string>;
  url: string;
  userAgent: string;
}

export interface ProviderContext {
  axios: any;
  cheerio: any;
  commonHeaders: Record<string, string>;
  kvStore: ProviderKvStore;
  getBaseUrl?: (providerValue: string) => Promise<string>;
  openWebView?: (url: string, options?: WebViewOptions) => Promise<WebViewResult>;
}

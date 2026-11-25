import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function ({
  providerContext,
}: {
  providerContext: ProviderContext;
}): Promise<SettingsField[]> {
  return [
    {
      key: "preferredQuality",
      type: "select",
      label: "Preferred Quality",
      description: "Default streaming and download resolution",
      options: [
        { label: "Auto", value: "auto" },
        { label: "4K Ultra HD (2160p)", value: "2160" },
        { label: "1440p (QHD)", value: "1440" },
        { label: "1080p (Full HD)", value: "1080" },
        { label: "720p (HD)", value: "720" },
        { label: "360p (Data Saver)", value: "360" },
        { label: "Audio Only", value: "audio" }
      ],
      defaultValue: "auto"
    },
    {
      key: "preferDirectCombined",
      type: "toggle",
      label: "Prefer Direct Single-File Format",
      description: "Always select pre-muxed single file formats for simpler offline playback and sharing",
      defaultValue: true
    }
  ];
};

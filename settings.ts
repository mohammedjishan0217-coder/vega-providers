import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function ({
  providerContext,
}: {
  providerContext: ProviderContext;
}): Promise<SettingsField[]> {
  return [
    {
      key: "baseUrlOverride",
      type: "text",
      label: "Custom Mirror Domain",
      description: "Override default domain if https://hanime.tv is blocked",
      placeholder: "https://hanime.tv",
      defaultValue: "",
    },
    {
      key: "preferredQuality",
      type: "select",
      label: "Preferred Streaming Quality",
      options: [
        { label: "Auto (Best Available)", value: "auto" },
        { label: "1080p Full HD", value: "1080" },
        { label: "720p HD", value: "720" },
        { label: "480p SD", value: "480" },
        { label: "360p LD", value: "360" },
      ],
      defaultValue: "auto",
    },
    {
      key: "allowedResolutions",
      type: "multiselect",
      label: "Allowed Resolutions",
      options: [
        { label: "1080p Full HD", value: "1080" },
        { label: "720p HD", value: "720" },
        { label: "480p SD", value: "480" },
        { label: "360p LD", value: "360" },
      ],
      defaultValue: ["1080", "720", "480", "360"],
    },
  ];
};

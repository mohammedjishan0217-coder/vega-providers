import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function ({
  providerContext,
}: {
  providerContext: ProviderContext;
}): Promise<SettingsField[]> {
  return [
    {
      type: "text",
      key: "baseUrlOverride",
      label: "Custom Domain / Mirror URL",
      placeholder: "https://hanime.tv",
      description: "Override the canonical domain if blocked or changed.",
    },
    {
      type: "select",
      key: "preferredQuality",
      label: "Preferred Stream Quality",
      defaultValue: "1080p",
      options: [
        { label: "1080p FHD", value: "1080p" },
        { label: "720p HD", value: "720p" },
        { label: "480p SD", value: "480p" },
        { label: "360p SD", value: "360p" },
      ],
      description: "Default quality resolution to prioritize when playing.",
    },
  ];
};

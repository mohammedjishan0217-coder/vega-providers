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
      placeholder: "https://anifam.net",
      description:
        "Override default domain if blocked (e.g., https://anifam.buzz, https://anifam.top, https://anifam.cfd)",
    },
    {
      type: "select",
      key: "preferredServer",
      label: "Preferred Streaming Server",
      defaultValue: "AniFam",
      options: [
        { label: "AniFam (Ultra-fast CDN)", value: "AniFam" },
        { label: "HD-1 (High Definition)", value: "HD-1" },
        { label: "HD-2 (Alternate HD)", value: "HD-2" },
        { label: "Vidstream-1", value: "Vidstream-1" },
        { label: "Vidstream-2", value: "Vidstream-2" },
      ],
      description: "Default server to prioritize when playing episodes.",
    },
    {
      type: "select",
      key: "preferredTrack",
      label: "Preferred Audio Track",
      defaultValue: "sub",
      options: [
        { label: "Subtitled (Japanese with English Subs)", value: "sub" },
        { label: "English Dub (English Audio)", value: "dub" },
      ],
      description: "Preferred default audio track for anime with multiple audios.",
    },
  ];
};

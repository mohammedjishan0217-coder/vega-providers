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
      description: "Override default domain if redtube is blocked (e.g. https://www.redtube.net)",
      placeholder: "https://www.redtube.net",
      defaultValue: "",
    },
    {
      key: "preferredQuality",
      type: "select",
      label: "Preferred Streaming Quality",
      description: "Default streaming quality when multiple are available",
      options: [
        { label: "Auto (Best Available)", value: "auto" },
        { label: "1080p Full HD", value: "1080" },
        { label: "720p HD", value: "720" },
        { label: "480p SD", value: "480" },
      ],
      defaultValue: "auto",
    },
    {
      key: "requestTimeout",
      type: "number",
      label: "Request Timeout (seconds)",
      description: "Maximum response wait time for requests",
      defaultValue: 15,
      min: 5,
      max: 60,
    },
  ];
};

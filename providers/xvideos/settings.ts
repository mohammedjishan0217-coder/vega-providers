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
      description: "Override default domain if xvideos is blocked (e.g. https://www.xvideos.com)",
      placeholder: "https://www.xvideos.com",
      defaultValue: "",
    },
    {
      key: "preferredQuality",
      type: "select",
      label: "Preferred Streaming Quality",
      description: "Default streaming quality when multiple are available",
      options: [
        { label: "Auto (HLS Adaptive)", value: "auto" },
        { label: "High Quality (720p)", value: "720" },
        { label: "Standard Quality (360p)", value: "360" },
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

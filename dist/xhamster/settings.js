"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingsSchema = void 0;

exports.getSettingsSchema = async function ({ providerContext }) {
  return [
    {
      key: "baseUrlOverride",
      type: "text",
      label: "Custom Mirror Domain",
      description: "Override default domain if xhamster is blocked (e.g. https://xhamster.com)",
      placeholder: "https://xhamster.com",
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

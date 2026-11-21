"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSettingsSchema = void 0;
const getSettingsSchema = async function ({
  providerContext
}) {
  return [{
    key: "baseUrlOverride",
    type: "text",
    label: "Custom Mirror Domain",
    description: "Override default domain if hanime.tv is blocked in your region",
    placeholder: "https://hanime.tv",
    defaultValue: ""
  }, {
    key: "preferredQuality",
    type: "select",
    label: "Preferred Streaming Quality",
    description: "Default streaming quality when multiple resolutions are available",
    options: [{
      label: "Auto (Best Available)",
      value: "auto"
    }, {
      label: "1080p Full HD",
      value: "1080"
    }, {
      label: "720p HD",
      value: "720"
    }, {
      label: "480p SD",
      value: "480"
    }, {
      label: "360p LD",
      value: "360"
    }],
    defaultValue: "auto"
  }, {
    key: "allowedResolutions",
    type: "multiselect",
    label: "Allowed Resolutions",
    description: "Choose which video resolutions to show in playback sources",
    options: [{
      label: "1080p Full HD",
      value: "1080"
    }, {
      label: "720p HD",
      value: "720"
    }, {
      label: "480p SD",
      value: "480"
    }, {
      label: "360p LD",
      value: "360"
    }],
    defaultValue: ["1080", "720", "480", "360"]
  }];
};
exports.getSettingsSchema = getSettingsSchema;

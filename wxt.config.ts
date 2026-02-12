import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/auto-icons"],
  manifest: {
    name: "Element GIFs",
    description: "Add GIF support to Element",
    version: "1.0.0",
    permissions: ["storage"],
    host_permissions: [
      "https://app.element.io/*",
      "https://api.klipy.com/*",
      "https://*.klipy.co/*",
      "https://*.klipy.com/*",
    ],
    browser_specific_settings: {
      gecko: {
        id: "{d27cd73c-4b44-4106-8b9f-7cc3a57e2fff}",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});

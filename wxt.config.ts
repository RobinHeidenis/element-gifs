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
  },
});

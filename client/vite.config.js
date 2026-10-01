import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// The API runs on port 4000. In development, Vite forwards every /api call
// there, so the app and the API look like one site (no CORS problems).
const apiProxy = { "/api": "http://localhost:4000" };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "TMS: Tenant Maintenance",
        short_name: "TMS",
        description: "Report and track maintenance requests for your rental unit.",
        theme_color: "#0f5c52",
        background_color: "#f5f7f6",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Opening any page while offline loads the app shell from the cache.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // Keep the last copy of the request lists, so they still show offline.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith("/api/") && request.method === "GET" && url.pathname !== "/api/health",
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
  // host: true lets you open the app from your phone on the same Wi-Fi.
  server: { host: true, port: 5173, proxy: apiProxy },
  preview: { host: true, port: 4173, proxy: apiProxy },
});

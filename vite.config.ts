import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // npm run dev / npm run preview 때 브라우저를 자동으로 연다
  server: { open: true },
  preview: { open: true },
  plugins: [
    react(),
    // 홈 화면에 추가 + 오프라인 실행. 새 버전을 배포하면 다음 방문 때 자동으로 바뀐다
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "씽씽 활쏘기 로또",
        short_name: "활쏘기 로또",
        description: "궁수가 풍선을 맞히면 로또공이 굴러 나오는 로또 번호 뽑기 게임",
        lang: "ko",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#bfe3f7",
        theme_color: "#bfe3f7",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,json}"],
        runtimeCaching: [
          {
            // 구글 웹폰트: 한 번 받은 글꼴은 오프라인에서도 쓰도록 저장
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});

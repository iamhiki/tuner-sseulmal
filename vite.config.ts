import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  // 상대 경로로 빌드해 GitHub Pages 같은 하위 경로 배포에서도 에셋이 깨지지 않게 한다.
  base: "./",
  plugins: [preact()],
});

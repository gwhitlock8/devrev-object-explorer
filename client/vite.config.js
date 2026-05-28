import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, 'public/fonts');
const hasChipFonts = fs.existsSync(path.join(fontsDir, 'ChipText-Regular.otf'));

const interFontLinks = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
`;

const chipFontPreloads = `
    <link rel="preload" href="/fonts/ChipText-Regular.otf" as="font" type="font/otf" crossorigin />
    <link rel="preload" href="/fonts/ChipDisp-Bold.otf" as="font" type="font/otf" crossorigin />
`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'font-setup',
      transformIndexHtml(html) {
        const fontLinks = hasChipFonts ? chipFontPreloads : interFontLinks;
        return html.replace('<!-- FONT_LINKS -->', fontLinks);
      },
    },
  ],
  define: {
    __HAS_CHIP_FONTS__: JSON.stringify(hasChipFonts),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});

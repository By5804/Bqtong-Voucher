import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import type { Plugin } from "vite"; // Dihapus karena tidak ada plugin lokal lagi
// import express from "express"; // Dihapus karena tidak ada plugin lokal lagi
// import axios from "axios"; // Dihapus karena tidak ada plugin lokal lagi
// import jwt from "jsonwebtoken"; // Dihapus karena tidak ada plugin lokal lagi

// Plugin localApiServer dihapus karena tidak dibutuhkan untuk update harga kompetitor.
// Jika Anda membutuhkan fungsionalitas backend lokal lainnya, ini bisa ditambahkan kembali.

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react()], // localApiServer() dihapus
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los datos del evento y de las familias siempre se leen en vivo desde
  // Supabase, así que no se usa el caché de componentes.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

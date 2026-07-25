import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Harmonic Compass",
    short_name: "Compass",
    description: "Real-time harmonic navigation and songwriting for guitarists.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d0c",
    theme_color: "#0b0d0c",
    orientation: "any",
    categories: ["music", "education", "productivity"],
    icons: [
      {
        src: "/icons/compass.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

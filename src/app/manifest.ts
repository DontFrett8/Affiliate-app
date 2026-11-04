import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PinFlow",
    short_name: "PinFlow",
    description: "Amazon affiliate → Pinterest workflow",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#e60023",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

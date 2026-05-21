import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LearnMate — Your Personal Study Buddy",
    short_name: "LearnMate",
    description:
      "Free, voice-first AI study assistant. Talk, chat, take notes, generate quizzes, polish research.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0F0E",
    theme_color: "#0B0F0E",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Talk with Bot",
        short_name: "Talk",
        url: "/talk",
        description: "Start a voice conversation",
      },
      {
        name: "Take Notes",
        short_name: "Notes",
        url: "/notes",
        description: "Capture a study session",
      },
      {
        name: "Quiz with Bot",
        short_name: "Quiz",
        url: "/quiz",
        description: "Generate practice questions",
      },
    ],
  };
}

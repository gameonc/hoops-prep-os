import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        court: {
          bg: "#0a0a0b",
          surface: "#121216",
          border: "#1f1f26",
          text: "#e8e8ea",
          muted: "#8a8a94",
          accent: "#ff6b35",     // basketball orange
          accent2: "#ffb100",    // hardwood
          good: "#22c55e",
          warn: "#f59e0b",
          bad: "#ef4444",
        },
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "-apple-system"],
      },
    },
  },
  plugins: [],
};

export default config;

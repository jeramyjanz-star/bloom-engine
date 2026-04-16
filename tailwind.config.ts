import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // BLOOM ENGINE design system
        "bloom-bg": "#0D0D0D",
        "bloom-card": "#161616",
        "bloom-border": "#262626",
        "bloom-gold": "#D4AF6A",
        "bloom-teal": "#00D4B4",
        "bloom-crimson": "#DC2626",
        "bloom-steel": "#94A3B8",
      },
      fontFamily: {
        playfair: ["var(--font-playfair)", "Playfair Display", "serif"],
        mono: ["var(--font-ibm-plex-mono)", "IBM Plex Mono", "monospace"],
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";


const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#13131f",
        primary: "#7c3aed",
        gold: "#ffd700",
        text: "#e2e8f0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Cinzel", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;


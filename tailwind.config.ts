import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", ".theme-dark"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        tide: "#164E63",
        foam: "#ECFEFF",
        coral: "#F97316",
        mint: "#22C55E",
        sun: "#FACC15",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        panel: "0 10px 30px -10px rgba(2, 6, 23, 0.35)",
      },
      backgroundImage: {
        "mesh-brand":
          "radial-gradient(circle at 20% 20%, rgba(249,115,22,0.24), transparent 45%), radial-gradient(circle at 80% 10%, rgba(34,197,94,0.22), transparent 35%), radial-gradient(circle at 50% 90%, rgba(21,94,117,0.30), transparent 40%)",
      },
    },
  },
  plugins: [],
};

export default config;

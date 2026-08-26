import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        deep: "rgb(var(--deep) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        panel2: "rgb(var(--panel2) / <alpha-value>)",
        gold: {
          light: "rgb(var(--gold-light) / <alpha-value>)",
          DEFAULT: "rgb(var(--gold) / <alpha-value>)",
          dark: "rgb(var(--gold-dark) / <alpha-value>)",
        },
        cream: "rgb(var(--cream) / <alpha-value>)",
        hairline: "rgb(var(--hairline-rgb) / 0.28)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gold-gradient":
          "linear-gradient(135deg, rgb(var(--gold-light)) 0%, rgb(var(--gold)) 45%, rgb(var(--gold-dark)) 100%)",
      },
    },
  },
  plugins: [],
};
export default config;

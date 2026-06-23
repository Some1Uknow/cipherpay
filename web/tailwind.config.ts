import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        neo: "2px 2px 0 0 #000",
        neoHover: "3px 3px 0 0 #000",
        neoSm: "2px 2px 0 0 #000",
        neoInset: "inset 0 0 0 1px #ddd",
        neoInsetDeep: "inset 0 0 0 1px #111",
        neoInsetSm: "inset 0 0 0 1px #ddd",
        neoPrimaryInsetSm: "inset 0 0 0 1px #111",
      },
      fontFamily: {
        sans: [
          "var(--font-body)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-body)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;

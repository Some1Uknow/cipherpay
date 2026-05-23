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
        neo: "9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)",
        neoHover: "12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)",
        neoSm: "5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)",
        neoInset: "inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)",
        neoInsetDeep: "inset 10px 10px 20px rgba(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)",
        neoInsetSm: "inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)",
        neoPrimaryInsetSm: "inset 3px 3px 6px rgba(0,0,0,0.18), inset -3px -3px 6px rgba(255,255,255,0.22)",
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

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { light: "#f5f5f5", dark: "#1a1a2e" },
        surface: { light: "#ffffff", dark: "#16213e" },
        ink: { light: "#1a1a2e", dark: "#e0e0e0" },
        accent: { light: "#4a90e2", dark: "#0f3460" },
        highlight: "#e94560",
      },
    },
  },
  plugins: [],
};

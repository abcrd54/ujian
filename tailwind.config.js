/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0058be",
        surface: "#f7f9fb",
        "surface-card": "#ffffff",
        "text-main": "#0f172a",
        "text-muted": "#64748b",
        border: "#e2e8f0",
      },
      boxShadow: {
        card: "0px 4px 12px rgba(30, 41, 59, 0.05)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      spacing: {
        gutter: "24px",
      },
    },
  },
  plugins: [],
};

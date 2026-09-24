import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      colors: { ink: "#171616", cream: "#fffdf9", coral: "#ff4232", mango: "#ffc32f", leaf: "#167544" },
      boxShadow: { float: "0 12px 36px rgba(69, 39, 20, .12)", lift: "0 6px 18px rgba(69, 39, 20, .1)" },
      borderRadius: { app: "1.5rem" },
      animation: { "float-in": "floatIn .45s ease-out both", "pulse-soft": "pulseSoft 2.5s ease-in-out infinite" },
      keyframes: {
        floatIn: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseSoft: { "0%, 100%": { opacity: "1" }, "50%": { opacity: ".65" } },
      },
    },
  },
  plugins: [],
};
export default config;

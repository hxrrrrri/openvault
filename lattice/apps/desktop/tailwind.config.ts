import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noir: "var(--bg)",
        graphite: "var(--graphite)",
        panel: "var(--card)",
        elevated: "var(--elevated)",
        violet: "var(--violet)",
        indigo: "var(--indigo)",
        mist: "var(--mist)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        glow: "var(--glow-violet)",
      },
    },
  },
  plugins: [],
};

export default config;

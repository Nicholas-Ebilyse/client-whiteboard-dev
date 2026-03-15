import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        "tonic-green": "hsl(var(--tonic-green))",
        "absent-pink": "hsl(var(--absent-pink))",
        "confirmed-blue": "hsl(var(--confirmed-blue))",
        "note": {
          confirmed: {
            DEFAULT: "hsl(var(--note-confirmed))",
            foreground: "hsl(var(--note-confirmed-foreground))",
          },
        },
        "assignment": {
          unconfirmed: {
            DEFAULT: "hsl(var(--assignment-unconfirmed))",
            foreground: "hsl(var(--assignment-unconfirmed-foreground))",
          },
          confirmed: {
            DEFAULT: "hsl(var(--assignment-confirmed))",
            foreground: "hsl(var(--assignment-confirmed-foreground))",
          },
          invoiced: {
            DEFAULT: "hsl(var(--assignment-invoiced))",
            foreground: "hsl(var(--assignment-invoiced-foreground))",
          },
        },
        "surface": {
          "1": "hsl(var(--surface-1))",
          "2": "hsl(var(--surface-2))",
          "3": "hsl(var(--surface-3))",
          "4": "hsl(var(--surface-4))",
          "5": "hsl(var(--surface-5))",
        },
        "state": {
          hover: "hsl(var(--state-hover))",
          focus: "hsl(var(--state-focus))",
          pressed: "hsl(var(--state-pressed))",
          dragged: "hsl(var(--state-dragged))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        "display-large": "var(--display-large)",
        "display-medium": "var(--display-medium)",
        "display-small": "var(--display-small)",
        "headline-large": "var(--headline-large)",
        "headline-medium": "var(--headline-medium)",
        "headline-small": "var(--headline-small)",
        "title-large": "var(--title-large)",
        "title-medium": "var(--title-medium)",
        "title-small": "var(--title-small)",
        "label-large": "var(--label-large)",
        "label-medium": "var(--label-medium)",
        "label-small": "var(--label-small)",
        "body-large": "var(--body-large)",
        "body-medium": "var(--body-medium)",
        "body-small": "var(--body-small)",
      },
      transitionTimingFunction: {
        "m3-standard": "var(--motion-easing-standard)",
        "m3-emphasized": "var(--motion-easing-emphasized)",
      },
      transitionDuration: {
        "m3-short": "var(--motion-duration-short)",
        "m3-medium": "var(--motion-duration-medium)",
        "m3-long": "var(--motion-duration-long)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

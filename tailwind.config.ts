import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.875rem', { lineHeight: '1.25rem' }],    // was 0.75rem (12px), now 14px
        'sm': ['1rem', { lineHeight: '1.375rem' }],       // was 0.875rem (14px), now 16px
        'base': ['1.125rem', { lineHeight: '1.5rem' }],   // was 1rem (16px), now 18px
        'lg': ['1.25rem', { lineHeight: '1.625rem' }],    // was 1.125rem (18px), now 20px
        'xl': ['1.375rem', { lineHeight: '1.75rem' }],    // was 1.25rem (20px), now 22px
        '2xl': ['1.625rem', { lineHeight: '2rem' }],      // was 1.5rem (24px), now 26px
        '3xl': ['2.125rem', { lineHeight: '2.375rem' }],  // was 1.875rem (30px), now 34px
        '4xl': ['2.5rem', { lineHeight: '2.75rem' }],     // was 2.25rem (36px), now 40px
        '5xl': ['3.125rem', { lineHeight: '3.375rem' }],  // was 3rem (48px), now 50px
        '6xl': ['3.875rem', { lineHeight: '4.125rem' }],  // was 3.75rem (60px), now 62px
        '7xl': ['4.625rem', { lineHeight: '4.875rem' }],  // was 4.5rem (72px), now 74px
        '8xl': ['6.125rem', { lineHeight: '6.375rem' }],  // was 6rem (96px), now 98px
        '9xl': ['8.125rem', { lineHeight: '8.375rem' }],  // was 8rem (128px), now 130px
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
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
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

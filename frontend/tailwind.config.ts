// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#E8EEF7',
          100: '#C2D0E8',
          200: '#98AECF',
          300: '#6E8CB7',
          400: '#4F72A6',
          500: '#2F5896',
          600: '#274F8A',
          700: '#1E3F79',
          800: '#153069',
          900: '#0B1F3A',
        },
        mint: {
          50:  '#E6F8F4',
          100: '#BFEEE5',
          200: '#94E3D4',
          300: '#68D7C2',
          400: '#47CFB5',
          500: '#26C7A8',
          600: '#22B89A',
          700: '#1CA589',
          800: '#159278',
          900: '#097059',
        },
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono:  ['var(--font-mono)',  'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card:  '0 4px 24px rgba(11,31,58,0.08)',
        float: '0 8px 40px rgba(11,31,58,0.14)',
        glow:  '0 0 30px rgba(60,190,160,0.25)',
      },
      animation: {
        'fade-up':    'fadeUp 0.5s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

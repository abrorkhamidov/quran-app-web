/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Spectral', 'ui-serif', 'Georgia', 'serif'],
        quran: ['"Amiri Quran"', 'Scheherazade New', 'serif'],
      },
      colors: {
        // Quiet Slate — muted greys, soft indigo accent (elevated for desktop depth)
        ink: { DEFAULT: '#2b3038', dark: '#e6e8ec' },
        muted: { DEFAULT: '#8b919b', dark: '#7a818c' },
        surface: { light: '#eceef1', dark: '#121419' },
        sidebar: { light: '#ffffff', dark: '#171a20' },
        card: { light: '#ffffff', dark: '#1d2026' },
        line: { light: '#e3e6ea', dark: '#272b33' },
        accent: { DEFAULT: '#4a5568', soft: '#7d8aa3' },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,24,33,0.04), 0 4px 16px rgba(20,24,33,0.04)',
        lift: '0 2px 4px rgba(20,24,33,0.05), 0 12px 32px rgba(20,24,33,0.07)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

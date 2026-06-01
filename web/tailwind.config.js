/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Quiet Slate — muted greys, soft indigo accent
        ink: { DEFAULT: '#2b3038', dark: '#e4e6ea' },
        muted: '#8b919b',
        surface: { light: '#f3f4f6', dark: '#1a1d23' },
        card: { light: '#e9ebef', dark: '#23272f' },
        accent: { DEFAULT: '#4a5568', soft: '#7d8aa3' },
      },
    },
  },
  plugins: [],
};

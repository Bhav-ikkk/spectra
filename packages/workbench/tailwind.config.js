/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#0B0C0E',
          base: '#0B0C0E',
          surface: '#131519',
          well: '#08090A',
        },
        rule: {
          DEFAULT: '#23262D',
          border: '#23262D',
          active: '#3F434F',
        },
        ink: {
          DEFAULT: '#F3F4F6',
          primary: '#F3F4F6',
          secondary: '#CBCED4',
          muted: '#8A8F98',
        },
        signal: {
          vermilion: '#FF453A',
          emerald: '#30D158',
          amber: '#F59E0B',
          cool: '#38BDF8',
        },
        obsidian: {
          950: '#08090A',
          900: '#0B0C0E',
          850: '#131519',
          800: '#1C1F26',
          700: '#23262D',
          600: '#3F434F',
        },
      },
      fontFamily: {
        sans: ['"Host Grotesk"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

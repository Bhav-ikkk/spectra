/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fm: {
          surface: '#EAE7DF',
          elevated: '#DFDCD3',
          well: '#D6D3C9',
          stage: '#E5E2DA',
          border: '#B8B4A9',
          'border-strong': '#181816',
          ink: '#181816',
          secondary: '#4A4843',
          muted: '#78756E',
          danger: '#E05246',
          'danger-soft': '#F2C6BE',
          'danger-text': '#9E2A22',
          verified: '#1D4D35',
          'verified-bg': '#DCE8DF',
        },
      },
      fontFamily: {
        sans: ['"Host Grotesk"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Atkinson Hyperlegible Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

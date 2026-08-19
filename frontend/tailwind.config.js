/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        'sr-dark': { DEFAULT: '#0a0e1a', card: 'rgba(15, 23, 42, 0.8)', surface: '#111827' },
        'sr-safe': '#10b981',
        'sr-warning': '#f59e0b',
        'sr-danger': '#ef4444',
        'sr-info': '#06b6d4',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        18: '4.5rem',
      },
      colors: {
        brand: {
          cyan: '#05C7F2',
          teal: '#04C4D9',
          neon: '#05F2F2',
          bg: '#F2F2F2',
          dark: '#0D0D0D',
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdecd3',
          200: '#fbd5a5',
          300: '#f8b86d',
          400: '#f59332',
          500: '#f2750a',
          600: '#e35a05',
          700: '#bc4208',
          800: '#95350e',
          900: '#782e0f',
        }
      }
    },
  },
  plugins: [],
} 
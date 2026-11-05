/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#090A0F',
        surface: '#12161A',
      },
    },
  },
  plugins: [],
};

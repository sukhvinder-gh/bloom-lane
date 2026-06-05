/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — earthy, agricultural
        earth: {
          50:  '#f6f3ee',
          100: '#ece5d8',
          200: '#d8c9b0',
          300: '#c0a882',
          400: '#a8875a',
          500: '#8b6b42',
          600: '#6d5234',
          700: '#503c26',
          800: '#35271a',
          900: '#1c140d',
        },
        green: {
          50:  '#f0f9f4',
          100: '#dcf0e5',
          200: '#bbe2ce',
          300: '#8dcdad',
          400: '#59b285',
          500: '#2d6a4f', // primary brand
          600: '#1f5040',
          700: '#163a2e',
          800: '#0e251d',
          900: '#07120e',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
}

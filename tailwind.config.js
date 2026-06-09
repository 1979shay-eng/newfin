/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'Heebo', 'system-ui', 'sans-serif'],
        serif: ['"Frank Ruhl Libre"', 'Georgia', 'serif'],
      },
      colors: {
        // פלטת מותג NewFin (זמני, נכוונן בהמשך)
        brand: {
          DEFAULT: '#0f4c81',
          dark: '#0a3358',
          light: '#3b7dd8',
        },
        signal: {
          high: '#dc2626', // מהותיות גבוהה
          mid: '#d97706', // בינונית
          low: '#9ca3af', // נמוכה
        },
      },
    },
  },
  plugins: [],
}

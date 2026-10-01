import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { cbms: { blue: '#253C6D', orange: '#F2842F', neutral: '#F2F2F2' } } } },
  plugins: [forms],
}

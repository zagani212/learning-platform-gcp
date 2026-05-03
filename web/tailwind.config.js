/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          50: '#f7f8fa',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0bac9',
          400: '#8594ab',
          500: '#667792',
          600: '#515f79',
          700: '#424d63',
          800: '#394253',
          900: '#1e2433',
          950: '#121622',
        },
        accent: {
          DEFAULT: '#3d7c6b',
          light: '#5aa896',
          dark: '#2d5f52',
        },
        coral: '#e07856',
      },
      boxShadow: {
        soft: '0 2px 8px rgb(18 22 34 / 0.06)',
        card: '0 4px 24px rgb(18 22 34 / 0.08)',
      },
    },
  },
  plugins: [],
};

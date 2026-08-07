/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          900: '#0B0F19',
          800: '#111827',
          700: '#1F2937',
          accent: '#3B82F6',
          gold: '#F59E0B',
          emerald: '#10B981',
        },
      },
    },
  },
  plugins: [],
};

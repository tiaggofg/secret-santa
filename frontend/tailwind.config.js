/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        'festive-cream': '#FAF7F2',
        'festive-night': '#0B2E23',
        'festive-card': '#FFFFFF',
        'festive-border': '#E8DFD1',
        pine: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          600: '#047857',
          700: '#155E47',
          800: '#0F4C3A',
          900: '#0A3629',
          950: '#061A14'
        },
        cranberry: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B'
        },
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#B45309',
          700: '#A16207',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03'
        },
        ink: {
          600: '#57534E',
          900: '#1C1917'
        }
      }
    }
  },
  plugins: []
};

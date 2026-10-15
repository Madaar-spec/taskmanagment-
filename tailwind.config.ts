import type { Config } from 'tailwindcss';

// رموز تصميم مدار — BRD القسم 6
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        header: 'rgb(var(--header-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong-rgb) / <alpha-value>)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        st: {
          new: '#9CC9F0',
          progress: '#F0CF7E',
          review: '#C9B3F2',
          done: '#6FD3BF',
        },
        pr: { high: '#F5A285', medium: '#F0CF7E', low: '#B9CDD1' },
      },
      fontFamily: {
        sans: ['"DIN Next LT Arabic"', '"Readex Pro"', 'Tahoma', 'sans-serif'],
      },
      borderRadius: { card: '14px', field: '10px', pill: '50px' },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
} satisfies Config;

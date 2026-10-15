import type { Config } from 'tailwindcss';

// رموز تصميم مدار — BRD القسم 6
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        header: 'var(--header)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        danger: 'var(--danger)',
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

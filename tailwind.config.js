/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background:      '#ffffff',
        surface:         '#ffffff',
        'surface-2':     '#f5f6fa',
        'surface-3':     '#edeef5',
        border:          '#e8eaf2',
        'border-light':  '#d0d4e8',
        primary:         '#6366f1',
        'primary-hover': '#5558e8',
        'primary-light': '#ede9fe',
        accent:          '#8b5cf6',
        success:         '#10b981',
        warning:         '#f59e0b',
        error:           '#ef4444',
        'text-primary':  '#1a1d2e',
        'text-secondary':'#4b5563',
        'text-muted':    '#9ca3af',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px 0 rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity:'0' }, '100%': { opacity:'1' } },
        slideUp: { '0%': { opacity:'0', transform:'translateY(10px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

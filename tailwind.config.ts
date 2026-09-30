import type { Config } from 'tailwindcss';

/**
 * Design system: cool, editorial, public-service.
 * Colour is always paired with a word or icon in the UI - never used as the sole carrier of meaning.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        ivory: { 50: '#F7F9F8', 100: '#EFF3F1', 200: '#E4EAE7' },
        mist: { 100: '#E8EDF0', 200: '#D6DEE3', 400: '#A8B6BE' },
        ink: { 900: '#0C1A16', 700: '#17332B', 500: '#3D564D', 400: '#647A72', 300: '#8FA29B' },
        forest: { 900: '#081A15', 800: '#0D2620', 700: '#12372F', 600: '#18493D', 500: '#1F5A4B' },
        teal: { 600: '#246F60', 500: '#2E8474', 400: '#4C9E8D' },
        sage: { 500: '#7FA79A', 400: '#9BBCB0', 200: '#CFE0D8', 100: '#E2ECE7' },
        lav: { 500: '#6E76A8', 400: '#8B93C0', 200: '#D3D7EA' },
        band: {
          stable: '#2E8474',
          watch: '#B08427',
          elevated: '#B4653F',
          high: '#9E4234',
        },
        /** One fixed colour per signal stream, used everywhere a stream appears. */
        stream: {
          case: '#9E4234',
          language: '#246F60',
          voice: '#6E76A8',
          engagement: '#7FA79A',
        },
        line: '#DCE4E0',
        'line-strong': '#C7D3CD',
      },
      fontFamily: {
        display: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 9vw, 8rem)', { lineHeight: '0.92', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.25rem, 6vw, 5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 3.6vw, 3rem)', { lineHeight: '1.04', letterSpacing: '-0.02em' }],
        'display-sm': ['clamp(1.35rem, 2.2vw, 1.9rem)', { lineHeight: '1.14', letterSpacing: '-0.015em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.18em' }],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        card: '0 1px 2px rgba(12,26,22,0.05), 0 12px 32px -24px rgba(12,26,22,0.35)',
        lift: '0 2px 6px rgba(12,26,22,0.06), 0 26px 54px -30px rgba(12,26,22,0.42)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      transitionTimingFunction: { editorial: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-soft': { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '1' } },
        sweep: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(200%)' } },
        /** Slow concentric expansion behind the voice capture control. */
        halo: {
          '0%': { transform: 'scale(0.85)', opacity: '0.5' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
        /** Travelling dash used to show data moving through the architecture. */
        flow: { from: { strokeDashoffset: '28' }, to: { strokeDashoffset: '0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
        sweep: 'sweep 1.6s ease-in-out infinite',
        halo: 'halo 2.8s ease-out infinite',
        flow: 'flow 1.1s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

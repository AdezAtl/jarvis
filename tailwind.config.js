/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#080e18',
        card: '#0c1624',
        primary: {
          DEFAULT: '#00f0ff',
          glow: 'rgba(0, 240, 255, 0.65)',
          muted: 'rgba(0, 240, 255, 0.15)',
        },
        secondary: '#0284c7',
        border: 'rgba(0, 240, 255, 0.25)',
        muted: '#1e293b',
        accent: '#38bdf8',
        destructive: '#ef4444',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['Rajdhani', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'spin-reverse-slow': 'spin-reverse 16s linear infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'pulse-cyan': 'pulseCyan 2s ease-in-out infinite',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        pulseCyan: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      }
    },
  },
  plugins: [],
}

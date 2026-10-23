/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        retro: ['"Silkscreen"', 'monospace'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        wood: {
          900: '#1d1210',
          800: '#2b1b16',
          700: '#43281c',
          600: '#633924',
          500: '#8c4e36',
          400: '#b86b47',
          300: '#da8a5d',
          200: '#f0b085',
        },
        parchment: {
          100: '#fff9e6',
          200: '#f8ecc2',
          300: '#edd69a',
        },
        slatepanel: '#1e141a',
        deepobs: '#140c13',
        terminal: '#251722',
        pixelgreen: '#38b764',
        pixelamber: '#feae34',
        pixelred: '#e43b44',
        pixelcyan: '#2ce8f5'
      },
      boxShadow: {
        'pixel-bezel': 'inset 2px 2px 0px rgba(255,255,255,0.15), inset -2px -2px 0px rgba(0,0,0,0.6)',
        'pixel-bezel-pushed': 'inset 2px 2px 0px rgba(0,0,0,0.7), inset -2px -2px 0px rgba(255,255,255,0.1)',
        'wood-frame': '0 0 0 3px #1a0f0d, 0 0 0 6px #6a3b2b, 0 8px 24px rgba(0,0,0,0.75)',
        'glow-cyan': '0 0 10px rgba(44, 232, 245, 0.4)',
        'glow-green': '0 0 8px rgba(56, 183, 100, 0.5)'
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.82, transform: 'scale(0.98)' },
        }
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
    require('@tailwindcss/forms'),
  ],
}

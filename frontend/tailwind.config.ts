import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Token permukaan dan teks sesuai design-system.md
        canvas: {
          light: '#F8FAFC',
          dark: '#09090B',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#121215',
        },
        header: {
          light: '#F1F5F9',
          dark: '#0C2D3E',
        },
        border: {
          light: '#E2E8F0',
          dark: '#27272A',
        },
        'text-primary': {
          light: '#0F172A',
          dark: '#F8FAFC',
        },
        'text-secondary': {
          light: '#475569',
          dark: '#A1A1AA',
        },
        'text-muted': {
          light: '#64748B',
          dark: '#71717A',
        },
        // Token brand aksen sesuai design-system.md
        brand: {
          primary: {
            light: '#1D4ED8',
            dark: '#38BDF8',
          },
          cyan: '#0EA5E9',
          violet: '#8B5CF6',
        },
        // Token status anomali sesuai pasangan persis design-system.md
        anomaly: {
          success: {
            'text-light': '#15803D',
            'bg-light': '#DCFCE7',
            'text-dark': '#4ADE80',
            'bg-dark': '#14532D',
          },
          warning: {
            'text-light': '#B45309',
            'bg-light': '#FEF3C7',
            'text-dark': '#FBBF24',
            'bg-dark': '#451A03',
          },
          danger: {
            'text-light': '#B91C1C',
            'bg-light': '#FEE2E2',
            'text-dark': '#F87171',
            'bg-dark': '#450A0A',
          },
        },
        // Token sel dimodifikasi manual sesuai design-system.md
        modified: {
          'bg-light': '#FEF08A',
          'border-light': '#CA8A04',
          'bg-dark': '#422006',
          'border-dark': '#EAB308',
        },
        forecast: {
          'ci-band': 'rgba(14, 165, 233, 0.15)',
        },
      },
      borderRadius: {
        card: '12px',
        modal: '12px',
        drawer: '12px',
        accordion: '12px',
        button: '8px',
        input: '8px',
        popover: '8px',
        'cell-input': '4px',
        cell: '0px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      minHeight: {
        control: '38px',
      },
    },
  },
  plugins: [],
} satisfies Config;

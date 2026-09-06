export const theme = {
  colors: {
    blue: {
      50: "var(--color-blue-50)",
      100: "var(--color-blue-100)",
      500: "var(--color-blue-500)",
      600: "var(--color-blue-600)",
      700: "var(--color-blue-700)",
    },
    gray: {
      50: "var(--color-gray-50)",
      100: "var(--color-gray-100)",
      200: "var(--color-gray-200)",
      300: "var(--color-gray-300)",
      400: "var(--color-gray-400)",
      500: "var(--color-gray-500)",
      600: "var(--color-gray-600)",
      700: "var(--color-gray-700)",
      800: "var(--color-gray-800)",
      900: "var(--color-gray-900)",
    },
    red: {
      50: "var(--color-red-50)",
      500: "var(--color-red-500)",
    },
    green: {
      50: "var(--color-green-50)",
      600: "var(--color-green-600)",
    },
    yellow: {
      50: "var(--color-yellow-50)",
      500: "var(--color-yellow-500)",
      600: "var(--color-yellow-600)",
    },
    background: "var(--background)",
    surface: "var(--surface)",
    surfaceMuted: "var(--surface-muted)",
    foreground: "var(--foreground)",
    foregroundMuted: "var(--foreground-muted)",
    borderSubtle: "var(--border-subtle)",
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    full: "var(--radius-full)",
  },
  shadow: {
    card: "var(--shadow-card)",
    float: "var(--shadow-float)",
  },
  motion: {
    duration: {
      fast: "150ms",
      normal: "200ms",
    },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
  },
} as const;

export type AppTheme = typeof theme;

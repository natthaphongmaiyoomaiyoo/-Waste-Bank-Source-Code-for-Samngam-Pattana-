export const midColors = {
  primary: '#087f49',
  primaryDark: '#06492d',
  primaryDeep: '#006f42',
  primarySoft: '#dbf4df',
  primarySurface: '#f3faf3',
  secondary: '#8dc63f',
  secondarySoft: '#e4f4df',
  info: '#168edb',
  infoSoft: '#dfe8fb',
  danger: '#dc2626',
  dangerDark: '#b91c1c',
  dangerSoft: '#fee2e2',
  warning: '#f59e0b',
  warningSoft: '#fff4d6',
  text: '#17452e',
  textStrong: '#06492d',
  textMuted: '#6d8a7c',
  border: '#d6e8db',
  surface: '#ffffff',
  appBackground: '#f7faf8',
} as const;

export const midRadii = {
  xs: '8px',
  sm: '12px',
  md: '14px',
  lg: '18px',
  xl: '20px',
  pill: '999px',
} as const;

export const midShadows = {
  soft: '0 14px 36px rgba(35, 74, 49, 0.08)',
  card: '0 18px 42px rgba(0, 82, 45, 0.12)',
  dialog: '0 28px 90px rgba(0, 72, 40, 0.28)',
  button: '0 18px 34px rgba(0, 102, 58, 0.22)',
} as const;

export const midGradients = {
  primary: `linear-gradient(135deg, ${midColors.primary}, ${midColors.primaryDeep})`,
  hero: 'linear-gradient(135deg, #00573d 0%, #00843e 56%, #48b52f 100%)',
  panel: 'linear-gradient(135deg, #f5fbf5, #ffffff)',
  footer: `linear-gradient(135deg, ${midColors.primaryDark}, ${midColors.primary})`,
} as const;

export const midSpacing = {
  cardPadding: '24px',
  panelPadding: '32px',
  dialogPadding: '34px 32px 28px',
  sectionGap: '24px',
} as const;

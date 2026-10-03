// ============================================================================
// Canonical QR Code Constants
// ============================================================================

export const QR_CONSTANTS = {
  DEFAULT_FOREGROUND: '#000000',
  DEFAULT_BACKGROUND: '#FFFFFF',
  PNG_WIDTH_HIGH_RES: 1024,
  PNG_WIDTH_STANDARD: 512,
  SVG_MARGIN: 2,
  ERROR_CORRECTION_HIGH: 'H' as const,
  ERROR_CORRECTION_MEDIUM: 'M' as const,
} as const;

export const QR_FORMATS = ['svg', 'png'] as const;
export type QrFormat = (typeof QR_FORMATS)[number];

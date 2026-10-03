import QRCode from 'qrcode';
import { QR_CONSTANTS } from '../constants/index.js';

export class QrService {
  /**
   * Generate SVG vector QR code for a short link using canonical QR_CONSTANTS
   */
  public static async generateSvg(
    url: string,
    options?: { foregroundColor?: string; backgroundColor?: string }
  ): Promise<string> {
    return QRCode.toString(url, {
      type: 'svg',
      color: {
        dark: options?.foregroundColor || QR_CONSTANTS.DEFAULT_FOREGROUND,
        light: options?.backgroundColor || QR_CONSTANTS.DEFAULT_BACKGROUND,
      },
      errorCorrectionLevel: QR_CONSTANTS.ERROR_CORRECTION_MEDIUM,
      margin: QR_CONSTANTS.SVG_MARGIN,
    });
  }

  /**
   * Generate PNG Buffer QR code for downloadable assets using canonical QR_CONSTANTS
   */
  public static async generatePngBuffer(
    url: string,
    options?: { foregroundColor?: string; backgroundColor?: string; width?: number }
  ): Promise<Buffer> {
    return QRCode.toBuffer(url, {
      type: 'png',
      width: options?.width || QR_CONSTANTS.PNG_WIDTH_HIGH_RES,
      color: {
        dark: options?.foregroundColor || QR_CONSTANTS.DEFAULT_FOREGROUND,
        light: options?.backgroundColor || QR_CONSTANTS.DEFAULT_BACKGROUND,
      },
      errorCorrectionLevel: QR_CONSTANTS.ERROR_CORRECTION_HIGH,
      margin: QR_CONSTANTS.SVG_MARGIN,
    });
  }
}

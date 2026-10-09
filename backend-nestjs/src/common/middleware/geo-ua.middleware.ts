import { Injectable, NestMiddleware } from '@nestjs/common';
import { HeaderNames, FALLBACK_IP } from '../../constants/headers.js';
import { env } from '../../config/env.js';

@Injectable()
export class GeoUAMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const headers = req.headers || req.raw?.headers || {};
    
    // Remote address unforgeable socket fallback
    const remoteAddress = req.ip || req.socket?.remoteAddress || req.raw?.socket?.remoteAddress || FALLBACK_IP;

    // Security C1: Only trust X-Forwarded-For / CF-Connecting-IP if TRUST_PROXY is explicitly enabled
    let clientIp = remoteAddress;
    if (env.TRUST_PROXY) {
      const cfIp = headers[HeaderNames.CF_CONNECTING_IP] as string | undefined;
      const xForwardedFor = headers[HeaderNames.X_FORWARDED_FOR] as string | undefined;
      clientIp = cfIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : remoteAddress);
    }

    const userAgent = (headers[HeaderNames.USER_AGENT] as string) || 'Unknown';
    const countryCode = (headers[HeaderNames.CF_IPCOUNTRY] as string) || undefined;
    const referrer = (headers[HeaderNames.REFERER] as string) || undefined;

    const geoUa = {
      clientIp,
      userAgent,
      countryCode,
      referrer,
    };
    req.geoUa = geoUa;
    if (req.raw) {
      req.raw.geoUa = geoUa;
    }
    next();
  }
}

export function getGeoUa(req: any) {
  if (req?.geoUa?.clientIp) return req.geoUa;
  if (req?.raw?.geoUa?.clientIp) return req.raw.geoUa;
  const headers = req?.headers || req?.raw?.headers || {};
  const remoteAddress = req?.ip || req?.socket?.remoteAddress || req?.raw?.socket?.remoteAddress || FALLBACK_IP;

  let clientIp = remoteAddress;
  if (env.TRUST_PROXY) {
    const cfIp = headers[HeaderNames.CF_CONNECTING_IP] as string | undefined;
    const xForwardedFor = headers[HeaderNames.X_FORWARDED_FOR] as string | undefined;
    clientIp = cfIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : remoteAddress);
  }

  const userAgent = (headers[HeaderNames.USER_AGENT] as string) || 'Unknown';
  const countryCode = (headers[HeaderNames.CF_IPCOUNTRY] as string) || undefined;
  const referrer = (headers[HeaderNames.REFERER] as string) || undefined;

  const geoUa = { clientIp, userAgent, countryCode, referrer };
  if (req) req.geoUa = geoUa;
  return geoUa;
}

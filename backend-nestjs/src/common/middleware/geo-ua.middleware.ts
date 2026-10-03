import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { HeaderNames, FALLBACK_IP } from '../../constants/headers.js';

@Injectable()
export class GeoUAMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const cfIp = req.headers[HeaderNames.CF_CONNECTING_IP] as string | undefined;
    const xForwardedFor = req.headers[HeaderNames.X_FORWARDED_FOR] as string | undefined;
    
    // Remote address fallback
    const remoteAddress = req.socket?.remoteAddress || FALLBACK_IP;
    const clientIp = cfIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : remoteAddress);

    const userAgent = (req.headers[HeaderNames.USER_AGENT] as string) || 'Unknown';
    const countryCode = (req.headers[HeaderNames.CF_IPCOUNTRY] as string) || undefined;
    const referrer = (req.headers[HeaderNames.REFERER] as string) || undefined;

    (req as any).geoUa = {
      clientIp,
      userAgent,
      countryCode,
      referrer,
    };
    next();
  }
}

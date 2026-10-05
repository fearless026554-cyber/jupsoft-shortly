import { Controller, Get, Post, Patch, Delete, Param, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as dns from 'node:dns/promises';
import * as os from 'node:os';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ApiScopes, ErrorCodes, RedisKeyBuilder } from '../constants/index.js';
import { env } from '../config/env.js';

const createDomainSchema = z.object({
  hostname: z.string().min(3).max(255).regex(/^[a-z0-9.-]+$/, 'Invalid hostname format'),
  type: z.enum(['subdomain', 'custom']),
});

const patchDomainSchema = z.object({
  verificationStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  dltStatus: z.enum(['pending', 'submitted', 'whitelisted', 'rejected']).optional(),
  dltRegistrationDetails: z.record(z.string(), z.unknown()).optional(),
  sslActive: z.boolean().optional(),
});

let cachedPublicIp: string | null = process.env.SERVER_PUBLIC_IP || null;
let cachedPublicIpAt = 0;

function getLocalLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const preferred: string[] = [];
  const others: string[] = [];

  for (const [name, list] of Object.entries(interfaces)) {
    if (!list) continue;
    const isVirtual = /vethernet|wsl|docker|vmware|vbox|hyper-v/i.test(name);
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        if (!isVirtual && (iface.address.startsWith('192.168.') || iface.address.startsWith('10.'))) {
          preferred.push(iface.address);
        } else {
          others.push(iface.address);
        }
      }
    }
  }
  return [...preferred, ...others];
}

async function getPublicWanIp(): Promise<string | null> {
  if (process.env.SERVER_PUBLIC_IP) {
    return process.env.SERVER_PUBLIC_IP;
  }
  const now = Date.now();
  if (cachedPublicIp && now - cachedPublicIpAt < 5 * 60 * 1000) {
    return cachedPublicIp;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { ip?: string };
      if (data?.ip) {
        cachedPublicIp = data.ip.trim();
        cachedPublicIpAt = now;
        return cachedPublicIp;
      }
    }
  } catch {
    // fallback if offline
  }
  return cachedPublicIp;
}

async function getLiveServerIp(): Promise<string> {
  const lanIps = getLocalLanIps();
  if (env.NODE_ENV !== 'production' && lanIps.length > 0) {
    return lanIps[0];
  }
  const wanIp = await getPublicWanIp();
  return wanIp || lanIps[0] || '127.0.0.1';
}

async function getValidServerIps(): Promise<string[]> {
  const lanIps = getLocalLanIps();
  const wanIp = await getPublicWanIp();
  const set = new Set<string>([...lanIps, '127.0.0.1']);
  if (wanIp) set.add(wanIp);
  return Array.from(set);
}

async function getAuthoritativeResolver(hostname: string): Promise<dns.Resolver> {
  const resolver = new dns.Resolver({ timeout: 2500, tries: 1 });
  const parts = hostname.toLowerCase().split('.');
  const candidateZones: string[] = [];
  for (let i = 0; i <= parts.length - 2; i++) {
    candidateZones.push(parts.slice(i).join('.'));
  }

  const pubResolver = new dns.Resolver({ timeout: 2000, tries: 1 });
  pubResolver.setServers(['1.1.1.1', '8.8.8.8']);

  for (const zone of candidateZones) {
    try {
      const nsHosts = await pubResolver.resolveNs(zone);
      if (nsHosts && nsHosts.length > 0) {
        const nsIps = await pubResolver.resolve4(nsHosts[0]);
        if (nsIps && nsIps.length > 0) {
          resolver.setServers([...nsIps, '1.1.1.1', '8.8.8.8']);
          return resolver;
        }
      }
    } catch {
      // try parent zone
    }
  }

  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  return resolver;
}

async function inspectLiveDns(hostname: string): Promise<{
  aRecords: string[];
  cnameRecords: string[];
  txtRecords: string[];
}> {
  const resolver = await getAuthoritativeResolver(hostname);
  let aRecords: string[] = [];
  let cnameRecords: string[] = [];
  let txtRecords: string[] = [];

  const [aRes, cnameRes, txtRes] = await Promise.allSettled([
    resolver.resolve4(hostname),
    resolver.resolveCname(hostname),
    resolver.resolveTxt(hostname),
  ]);

  if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) {
    aRecords = aRes.value;
  }
  if (cnameRes.status === 'fulfilled' && Array.isArray(cnameRes.value)) {
    cnameRecords = cnameRes.value.map((r) => r.toLowerCase().replace(/\.$/, ''));
  }
  if (txtRes.status === 'fulfilled' && Array.isArray(txtRes.value)) {
    txtRecords = txtRes.value.map((chunks) => chunks.join(''));
  }

  return { aRecords, cnameRecords, txtRecords };
}

@Controller('api/v1/domains')
@UseGuards(AuthGuard)
export class DomainsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Get()
  @RequireScope(ApiScopes.LINKS_READ)
  async listDomains(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const [domains, serverIp] = await Promise.all([
      this.db.pool.query(
        `SELECT id, tenant_id, hostname, type, verification_status, dlt_status, ssl_active, created_at
         FROM domains
         WHERE tenant_id = $1 OR tenant_id IS NULL
         ORDER BY (tenant_id IS NOT NULL) DESC, (verification_status = 'verified') DESC, created_at ASC`,
        [tenantId]
      ),
      getLiveServerIp(),
    ]);

    const enrichedRows = await Promise.all(
      domains.rows.map(async (row) => {
        const txtToken = `shortly-verify=${String(row.id).slice(0, 8)}`;
        let liveDns = { aRecords: [] as string[], cnameRecords: [] as string[], txtRecords: [] as string[] };
        if (row.type === 'custom' || row.tenant_id !== null) {
          try {
            liveDns = await inspectLiveDns(row.hostname);
          } catch {
            // ignore lookup error
          }
        }
        return {
          ...row,
          txt_token: txtToken,
          server_ip: serverIp,
          live_dns: liveDns,
        };
      })
    );

    return reply.send({
      success: true,
      data: enrichedRows,
      dnsConfig: {
        serverIp,
        cnameTarget: env.DEFAULT_DOMAIN_HOST,
      },
    });
  }

  @Post()
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async createDomain(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = createDomainSchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const cleanHost = dto.hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    try {
      const res = await this.db.pool.query(
        `INSERT INTO domains (tenant_id, hostname, type, verification_status, dlt_status)
         VALUES ($1, $2, $3, 'pending', 'pending')
         RETURNING *`,
        [tenantId, cleanHost, dto.type]
      );

      const row = res.rows[0];
      const serverIp = await getLiveServerIp();
      return reply.status(201).send({
        success: true,
        data: {
          ...row,
          txt_token: `shortly-verify=${String(row.id).slice(0, 8)}`,
          server_ip: serverIp,
        },
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCodes.DOMAIN_CONFLICT, message: 'This hostname is already registered' },
        });
      }
      throw err;
    }
  }

  @Get(':id')
  @RequireScope(ApiScopes.LINKS_READ)
  async getDomain(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const res = await this.db.pool.query(
      `SELECT id, tenant_id, hostname, type, verification_status, dlt_status, dlt_registration_details, ssl_active, created_at
       FROM domains
       WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [id, tenantId]
    );

    if (res.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Domain not found' },
      });
    }

    return reply.send({ success: true, data: res.rows[0] });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async updateDomain(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const dto = patchDomainSchema.parse(req.body);

    const currentRes = await this.db.pool.query(
      'SELECT * FROM domains WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
      [id, tenantId]
    );
    if (currentRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Domain not found' },
      });
    }
    const current = currentRes.rows[0];

    const verificationStatus = dto.verificationStatus ?? current.verification_status;
    const dltStatus = dto.dltStatus ?? current.dlt_status;
    const dltRegistrationDetails = dto.dltRegistrationDetails
      ? JSON.stringify(dto.dltRegistrationDetails)
      : current.dlt_registration_details;
    const sslActive = dto.sslActive !== undefined ? dto.sslActive : current.ssl_active;

    const res = await this.db.pool.query(
      `UPDATE domains
       SET verification_status = $1, dlt_status = $2, dlt_registration_details = $3, ssl_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [verificationStatus, dltStatus, dltRegistrationDetails, sslActive, id]
    );

    await this.redis.client.del(RedisKeyBuilder.domain(current.hostname));

    return reply.send({ success: true, data: res.rows[0] });
  }

  @Delete(':id')
  @RequireScope(ApiScopes.ADMIN)
  async deleteDomain(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const currentRes = await this.db.pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (currentRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Custom domain not found' },
      });
    }
    const current = currentRes.rows[0];

    await this.db.pool.query('DELETE FROM domains WHERE id = $1', [id]);
    await this.redis.client.del(RedisKeyBuilder.domain(current.hostname));

    return reply.send({ success: true });
  }

  @Post(':id/verify')
  @RequireScope(ApiScopes.ADMIN)
  async verifyDomain(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth?.tenantId;

    const currentRes = await this.db.pool.query(
      'SELECT * FROM domains WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
      [id, tenantId]
    );
    if (currentRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Domain not found' },
      });
    }
    const current = currentRes.rows[0];
    const [serverIp, validIps] = await Promise.all([getLiveServerIp(), getValidServerIps()]);
    const expectedTxt = `shortly-verify=${String(current.id).slice(0, 8)}`;
    const expectedCname = env.DEFAULT_DOMAIN_HOST.toLowerCase();

    const { aRecords, cnameRecords, txtRecords } = await inspectLiveDns(current.hostname);

    const matchedIp = aRecords.find((ip) => validIps.includes(ip));
    const matchedA = Boolean(matchedIp);
    const matchedTxt = txtRecords.some((t) => t.includes(expectedTxt));
    const matchedCname = cnameRecords.some(
      (c) => c === expectedCname || c === `cname.${expectedCname}`
    );

    if (!matchedA && !matchedTxt && !matchedCname) {
      await this.db.pool.query(
        `UPDATE domains
         SET verification_status = 'failed', ssl_active = false, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      let foundDetail = 'No A, CNAME, or TXT records found in live DNS.';
      if (aRecords.length > 0) {
        foundDetail = `Live DNS A record currently points to [${aRecords.join(', ')}].`;
      } else if (cnameRecords.length > 0) {
        foundDetail = `Live DNS CNAME currently points to [${cnameRecords.join(', ')}].`;
      }

      return reply.status(400).send({
        success: false,
        error: {
          code: 'DNS_VERIFICATION_FAILED',
          message: `DNS verification failed for ${current.hostname}: ${foundDetail} Point your A record to ${serverIp} (or add TXT record "${expectedTxt}") at your DNS provider and try again.`,
        },
        liveDns: { aRecords, cnameRecords, txtRecords, expectedIp: serverIp, expectedTxt },
      });
    }

    const res = await this.db.pool.query(
      `UPDATE domains
       SET verification_status = 'verified', dlt_status = 'whitelisted', ssl_active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await this.redis.client.del(RedisKeyBuilder.domain(current.hostname));

    return reply.send({
      success: true,
      data: {
        ...res.rows[0],
        txt_token: expectedTxt,
        server_ip: serverIp,
        live_dns: { aRecords, cnameRecords, txtRecords },
      },
      matchedBy: matchedA ? `A (${matchedIp})` : matchedTxt ? `TXT (${expectedTxt})` : `CNAME (${cnameRecords[0]})`,
    });
  }
}

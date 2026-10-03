// ============================================================================
// JLMP Core Types & Contracts (Backend Domain)
// ============================================================================

export type TenantStatus = 'active' | 'suspended' | 'archived';
export type UserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'user' | 'read_only';
export type UserStatus = 'active' | 'invited' | 'suspended';

export type DomainType = 'internal' | 'public' | 'subdomain' | 'custom';
export type DomainVerificationStatus = 'pending' | 'verified' | 'failed';
export type DltWhitelistingStatus = 'pending' | 'submitted' | 'whitelisted' | 'rejected';

export type RedirectType = '302' | '307';
export type LinkStatus = 'active' | 'disabled' | 'expired' | 'archived' | 'blocked';

export type ScreeningVerdict = 'clean' | 'phishing' | 'malware' | 'suspicious';
export type AbuseReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  planId: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Domain {
  id: string;
  tenantId?: string | null;
  hostname: string;
  type: DomainType;
  verificationStatus: DomainVerificationStatus;
  dltStatus: DltWhitelistingStatus;
  dltRegistrationDetails: Record<string, unknown>;
  sslActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Link {
  id: string;
  tenantId: string;
  domainId: string;
  shortCode: string;
  alias?: string | null;
  destinationUrl: string;
  redirectType: RedirectType;
  status: LinkStatus;
  expiresAt?: Date | null;
  maxClicks?: number | null;
  clickCount: number;
  tag?: string | null;
  externalRef?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QrCodeRecord {
  id: string;
  linkId: string;
  isDynamic: boolean;
  foregroundColor: string;
  backgroundColor: string;
  qrSvgData?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CachedLink {
  id: string;
  tenantId: string;
  domainId: string;
  destinationUrl: string;
  redirectType: 302 | 307;
  status: LinkStatus;
  expiresAt?: number | null; // ms epoch
  maxClicks?: number | null;
  currentClicks: number;
}

// BullMQ Queue Jobs
export interface ClickIngestJobData {
  linkId: string;
  tenantId: string;
  domainId: string;
  clickedAt: string; // ISO 8601
  ip: string;        // In-memory strictly; hashed before DB persistence
  userAgent: string;
  referrer?: string;
  countryCode?: string;
}

export interface BulkLinkJobItem {
  destinationUrl: string;
  alias?: string;
  domainId?: string;
  tag?: string;
  externalRef?: string;
  expiresAt?: string;
}

export interface BulkLinkJobData {
  jobId: string;
  tenantId: string;
  domainId: string;
  links: BulkLinkJobItem[];
}

export interface UrlScreeningJobData {
  linkId: string;
  destinationUrl: string;
}

// REST API DTOs
export interface CreateLinkDto {
  destinationUrl: string;
  alias?: string;
  domainId?: string;
  expiresAt?: string;
  maxClicks?: number;
  tag?: string;
  externalRef?: string;
  redirectType?: RedirectType;
}

export interface OutcomeEventDto {
  linkId?: string;
  eventId?: string;
  externalRef?: string;
  outcomeType: string;
  value?: number;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAbuseReportDto {
  linkShortCodeOrUrl: string;
  reason: string;
  reporterEmail?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

import { useState, useEffect } from 'react';
import { api } from '../api';

export const DEFAULT_SHORT_DOMAIN =
  process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN || '';
export const DEFAULT_CNAME_DOMAIN =
  process.env.NEXT_PUBLIC_CNAME_DOMAIN || '';

export function buildShortUrl(domain: string, shortCode: string): string {
  return `https://${domain}/${shortCode}`;
}

let cachedDefaultDomain: string | null = null;

export function resetCachedTenantDomain() {
  cachedDefaultDomain = null;
}

export function useTenantDomains() {
  const [defaultDomain, setDefaultDomain] = useState(() => cachedDefaultDomain || DEFAULT_SHORT_DOMAIN);
  const [cnameDomain] = useState(DEFAULT_CNAME_DOMAIN);

  useEffect(() => {
    if (cachedDefaultDomain) {
      setDefaultDomain(cachedDefaultDomain);
      return;
    }

    api.getDomains().then(domains => {
      if (domains && domains.length > 0) {
        const verified = domains.find(d => d.verification_status === 'verified');
        const resolved = verified ? verified.hostname : domains[0].hostname;
        cachedDefaultDomain = resolved;
        setDefaultDomain(resolved);
      }
    }).catch(() => {});
  }, []);

  return { defaultDomain, cnameDomain };
}

import { useState, useEffect } from 'react';
import { api } from '../api';

export const DEFAULT_SHORT_DOMAIN =
  process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN || '';
export const DEFAULT_CNAME_DOMAIN =
  process.env.NEXT_PUBLIC_CNAME_DOMAIN || '';

export function buildShortUrl(domain: string, shortCode: string): string {
  return `https://${domain}/${shortCode}`;
}

const STORAGE_KEY = 'jlmp_cached_default_domain';

function getInitialCachedDomain(): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return DEFAULT_SHORT_DOMAIN;
}

let cachedDefaultDomain: string | null = null;
let inFlightConfigPromise: Promise<string> | null = null;

export function resetCachedTenantDomain() {
  cachedDefaultDomain = null;
  inFlightConfigPromise = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function resolveTenantDomain(): Promise<string> {
  if (cachedDefaultDomain) {
    return Promise.resolve(cachedDefaultDomain);
  }

  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedDefaultDomain = stored;
      return Promise.resolve(stored);
    }
  }

  if (inFlightConfigPromise) {
    return inFlightConfigPromise;
  }

  inFlightConfigPromise = (async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg?.defaultShortDomain) {
          cachedDefaultDomain = cfg.defaultShortDomain;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(STORAGE_KEY, cfg.defaultShortDomain);
          }
          return cfg.defaultShortDomain;
        }
      }

      const domains = await api.getDomains();
      if (Array.isArray(domains) && domains.length > 0) {
        const verified = domains.find((d: any) => d.verification_status === 'verified');
        const resolved = verified ? verified.hostname : domains[0].hostname;
        if (resolved) {
          cachedDefaultDomain = resolved;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(STORAGE_KEY, resolved);
          }
          return resolved;
        }
      }
    } catch {
      // Fallback gracefully
    } finally {
      inFlightConfigPromise = null;
    }

    const fallback = DEFAULT_SHORT_DOMAIN || '';
    if (fallback) {
      cachedDefaultDomain = fallback;
    }
    return fallback;
  })();

  return inFlightConfigPromise;
}

export function useTenantDomains() {
  const [defaultDomain, setDefaultDomain] = useState<string>(() => {
    return cachedDefaultDomain || getInitialCachedDomain();
  });
  const [cnameDomain] = useState(DEFAULT_CNAME_DOMAIN);

  useEffect(() => {
    let isMounted = true;

    if (cachedDefaultDomain) {
      setDefaultDomain(cachedDefaultDomain);
      return;
    }

    resolveTenantDomain().then((domain) => {
      if (isMounted && domain) {
        setDefaultDomain(domain);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return { defaultDomain, cnameDomain };
}

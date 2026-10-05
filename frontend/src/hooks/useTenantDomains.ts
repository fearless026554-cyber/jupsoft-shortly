import { useState, useEffect } from 'react';
import { api } from '../api';

export const DEFAULT_SHORT_DOMAIN =
  process.env.NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN || 'jup.link';
export const DEFAULT_CNAME_DOMAIN =
  process.env.NEXT_PUBLIC_CNAME_DOMAIN || `cname.${DEFAULT_SHORT_DOMAIN}`;

export function useTenantDomains() {
  const [defaultDomain, setDefaultDomain] = useState(DEFAULT_SHORT_DOMAIN);
  const [cnameDomain] = useState(DEFAULT_CNAME_DOMAIN);

  useEffect(() => {
    api.getDomains().then(domains => {
      if (domains && domains.length > 0) {
        const verified = domains.find(d => d.verification_status === 'verified');
        if (verified) {
          setDefaultDomain(verified.hostname);
        } else {
          setDefaultDomain(domains[0].hostname);
        }
      }
    }).catch(() => {});
  }, []);

  return { defaultDomain, cnameDomain };
}

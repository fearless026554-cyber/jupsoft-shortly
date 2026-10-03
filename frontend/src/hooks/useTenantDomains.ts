import { useState, useEffect } from 'react';
import { api } from '../api';

export function useTenantDomains() {
  const [defaultDomain, setDefaultDomain] = useState('jup.link');
  const [cnameDomain] = useState('cname.jup.link');

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

import { useEffect, useState } from 'react';
import { promoService } from '../services/promo.service';

/** Set of provider auth ids that currently have iStylist Pro. */
export function useProIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    promoService.getProIds().then((s) => !cancelled && setIds(s));
    return () => {
      cancelled = true;
    };
  }, []);
  return ids;
}

/** Best-effort auth id of a provider object, whatever shape the screen has. */
export const providerAuthIdOf = (p: any): string | undefined =>
  p?.auth_id || p?.provider_auth_id || p?.authId || p?.user?.auth_id || p?.user?.authId || p?.user_id || undefined;

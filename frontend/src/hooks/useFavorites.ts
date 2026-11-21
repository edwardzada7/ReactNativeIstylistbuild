import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { favoritesService } from '../services/favorites.service';

/** The signed-in user's saved providers, shared by every screen. */
export function useFavorites() {
  const { user } = useAuth();
  const owner = user?.auth_id || null;
  const [ids, setIds] = useState<ReadonlySet<string>>(() => favoritesService.peek(owner));

  useEffect(() => {
    let active = true;
    setIds(favoritesService.peek(owner));
    if (!owner) return undefined;
    if (!favoritesService.isLoaded(owner)) favoritesService.load(owner).catch(() => undefined);
    const off = favoritesService.subscribe(() => { if (active) setIds(new Set(favoritesService.peek(owner))); });
    return () => { active = false; off(); };
  }, [owner]);

  const isFavorite = useCallback((id?: string | null) => !!id && ids.has(String(id)), [ids]);
  const toggle = useCallback(
    (providerAuthId: string) => {
      if (!owner) return Promise.reject(new Error('Please sign in first.'));
      return favoritesService.toggle(owner, providerAuthId);
    },
    [owner]
  );
  return { ids, isFavorite, toggle, signedIn: !!owner };
}

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { blockService } from '../services/block.service';

/**
 * The signed-in user's block list, kept in sync across every screen.
 * `isBlocked(authId)` is what feeds, comments and chat use to hide content.
 */
export function useBlockedUsers() {
  const { user } = useAuth();
  const ownerId = user?.auth_id || null;
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => blockService.peek(ownerId));
  const [loaded, setLoaded] = useState(() => blockService.isLoaded(ownerId));

  useEffect(() => {
    let active = true;
    if (!ownerId) {
      setBlocked(blockService.peek(null));
      setLoaded(false);
      return undefined;
    }
    setBlocked(blockService.peek(ownerId));
    setLoaded(blockService.isLoaded(ownerId));
    blockService
      .load(ownerId)
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        setBlocked(new Set(blockService.peek(ownerId)));
        setLoaded(true);
      });
    const unsubscribe = blockService.subscribe(() => {
      if (active) setBlocked(new Set(blockService.peek(ownerId)));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ownerId]);

  const isBlocked = useCallback(
    (authId?: string | null) => !!authId && blocked.has(String(authId)),
    [blocked]
  );

  const block = useCallback(
    async (targetAuthId: string) => {
      if (!ownerId) throw new Error('Please sign in first.');
      await blockService.block(ownerId, targetAuthId);
    },
    [ownerId]
  );

  const unblock = useCallback(
    async (targetAuthId: string) => {
      if (!ownerId) throw new Error('Please sign in first.');
      await blockService.unblock(ownerId, targetAuthId);
    },
    [ownerId]
  );

  return { blocked, loaded, isBlocked, block, unblock };
}

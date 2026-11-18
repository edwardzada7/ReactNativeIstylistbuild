import { supabase } from '../lib/supabase';
import { peopleService } from './people.service';

/**
 * User blocking (App Store Guideline 1.2 / Google Play UGC policy).
 *
 * Reads and writes the `user_blocks` table (backend/supabase/user_blocks.sql)
 * straight through Supabase with the signed-in user's session; row level security
 * limits each person to their own rows. The list is cached in memory and every
 * screen that shows other people's content subscribes to changes, so blocking
 * someone removes their content everywhere immediately.
 */

type Listener = () => void;

const EMPTY: ReadonlySet<string> = new Set();

const state: {
  owner: string | null;
  ids: Set<string>;
  loaded: boolean;
  inflight: Promise<Set<string>> | null;
} = { owner: null, ids: new Set(), loaded: false, inflight: null };

const listeners = new Set<Listener>();
const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others.
    }
  });
};

// A different account signed in: forget the previous account's list.
function switchOwner(owner: string | null) {
  if (state.owner === owner) return;
  state.owner = owner;
  state.ids = new Set();
  state.loaded = false;
  state.inflight = null;
  notify();
}

export interface BlockedProfile {
  id: string;
  name: string;
  avatar: string | null;
}

export const blockService = {
  /** Synchronous read of the cached list (empty until load() has finished). */
  peek(owner: string | null | undefined): ReadonlySet<string> {
    return owner && state.owner === owner ? state.ids : EMPTY;
  },

  isLoaded(owner: string | null | undefined): boolean {
    return !!owner && state.owner === owner && state.loaded;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async load(owner: string, force = false): Promise<ReadonlySet<string>> {
    switchOwner(owner);
    if (state.loaded && !force) return state.ids;
    if (state.inflight) return state.inflight;

    const run: Promise<Set<string>> = (async () => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_auth_id')
        .eq('blocker_auth_id', owner)
        .limit(1000);
      if (error) {
        // Most likely the user_blocks.sql migration has not been run yet. Keep the
        // app usable (nobody blocked) and try again next time instead of caching this.
        console.warn('[blocks] could not load the block list:', error.message);
        return state.ids;
      }
      if (state.owner === owner) {
        state.ids = new Set((data || []).map((row: any) => String(row.blocked_auth_id)));
        state.loaded = true;
        notify();
      }
      return state.ids;
    })().finally(() => {
      state.inflight = null;
    });
    state.inflight = run;
    return run;
  },

  async block(owner: string, target: string): Promise<void> {
    if (!owner || !target) throw new Error('Missing user.');
    if (owner === target) {
      throw Object.assign(new Error('Cannot block yourself'), { friendlyMessage: "You can't block yourself." });
    }
    const { error } = await supabase
      .from('user_blocks')
      .upsert(
        { blocker_auth_id: owner, blocked_auth_id: target },
        { onConflict: 'blocker_auth_id,blocked_auth_id', ignoreDuplicates: true }
      );
    if (error) {
      console.warn('[blocks] block failed:', error.message);
      throw Object.assign(new Error(error.message), {
        friendlyMessage: 'Could not block this user right now. Please try again in a moment.',
      });
    }
    switchOwner(owner);
    state.ids = new Set(state.ids).add(String(target));
    notify();
    // Pick up anything else that was blocked on another device.
    void blockService.load(owner, true).catch(() => undefined);
  },

  async unblock(owner: string, target: string): Promise<void> {
    if (!owner || !target) throw new Error('Missing user.');
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_auth_id', owner)
      .eq('blocked_auth_id', target);
    if (error) {
      console.warn('[blocks] unblock failed:', error.message);
      throw Object.assign(new Error(error.message), {
        friendlyMessage: 'Could not unblock this user right now. Please try again in a moment.',
      });
    }
    switchOwner(owner);
    const next = new Set(state.ids);
    next.delete(String(target));
    state.ids = next;
    notify();
  },

  /** Names and photos for the Blocked Users screen. */
  async describe(ids: string[]): Promise<BlockedProfile[]> {
    return Promise.all(
      ids.map(async (id) => {
        const person = await peopleService.getByAuthId(id).catch(() => null);
        return { id, name: person?.name || 'iStylist member', avatar: person?.avatar || null };
      })
    );
  },
};

import { supabase } from '../lib/supabase';

/**
 * Saved (favourite) providers. Stored in `favorite_providers` (phase29 SQL) and read/written
 * through Supabase with the signed-in user's session; row level security limits each person
 * to their own rows. Cached in memory and broadcast so every heart button updates together.
 */
type Listener = () => void;
const state = { owner: null as string | null, ids: new Set<string>(), loaded: false };
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => { try { l(); } catch { /* ignore */ } });
const isUuid = (v?: string | null) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(v));

function switchOwner(owner: string | null) {
  if (state.owner === owner) return;
  state.owner = owner; state.ids = new Set(); state.loaded = false; notify();
}

export const favoritesService = {
  isValidId: isUuid,
  peek(owner: string | null): ReadonlySet<string> { return state.owner === owner ? state.ids : new Set(); },
  isLoaded(owner: string | null) { return state.owner === owner && state.loaded; },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },

  async load(owner: string): Promise<Set<string>> {
    switchOwner(owner);
    const { data, error } = await supabase.from('favorite_providers').select('provider_auth_id').eq('user_auth_id', owner);
    if (error) throw error;
    state.ids = new Set((data || []).map((r: any) => String(r.provider_auth_id)));
    state.loaded = true; notify();
    return state.ids;
  },

  /** Optimistic toggle: heart changes at once, and is rolled back if saving fails. */
  async toggle(owner: string, providerAuthId: string): Promise<boolean> {
    switchOwner(owner);
    const was = state.ids.has(providerAuthId);
    const next = new Set(state.ids);
    was ? next.delete(providerAuthId) : next.add(providerAuthId);
    state.ids = next; notify();
    try {
      const res = was
        ? await supabase.from('favorite_providers').delete().eq('user_auth_id', owner).eq('provider_auth_id', providerAuthId)
        : await supabase.from('favorite_providers').upsert({ user_auth_id: owner, provider_auth_id: providerAuthId }, { onConflict: 'user_auth_id,provider_auth_id' });
      if (res.error) throw res.error;
      return !was;
    } catch (err) {
      const back = new Set(state.ids);
      was ? back.add(providerAuthId) : back.delete(providerAuthId);
      state.ids = back; notify();
      throw err;
    }
  },
};

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/chat.service';

interface UnreadMessagesContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | undefined>(undefined);

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user?.auth_id) {
      setUnreadCount(0);
      return;
    }
    setUnreadCount(await chatService.getUnreadCount());
  }, [isAuthenticated, user?.auth_id]);

  useEffect(() => {
    refreshUnreadCount();
    if (!isAuthenticated || !user?.auth_id) return;

    const channel = supabase
      .channel(`unread-messages-${user.auth_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `receiver_auth_id=eq.${user.auth_id}` }, refreshUnreadCount)
      .subscribe();

    // Realtime only works if the table is published for it, so also refresh when the
    // app returns to the foreground and every 30s while it is open.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadCount();
    });
    const interval = setInterval(() => void refreshUnreadCount(), 30000);

    return () => {
      clearInterval(interval);
      appStateSub.remove();
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.auth_id, refreshUnreadCount]);

  return <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);
  if (!context) throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  return context;
}

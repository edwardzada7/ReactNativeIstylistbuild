import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const refreshUnreadCount = async () => {
    if (!isAuthenticated || !user?.auth_id) {
      setUnreadCount(0);
      return;
    }
    setUnreadCount(await chatService.getUnreadCount());
  };

  useEffect(() => {
    refreshUnreadCount();
    if (!isAuthenticated || !user?.auth_id) return;

    const channel = supabase
      .channel(`unread-messages-${user.auth_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `receiver_auth_id=eq.${user.auth_id}` }, refreshUnreadCount)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.auth_id]);

  return <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);
  if (!context) throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  return context;
}

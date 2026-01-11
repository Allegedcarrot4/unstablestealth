import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TypingUser {
  session_id: string;
  is_typing: boolean;
  updated_at: string;
}

interface Profile {
  session_id: string;
  username: string;
}

export const TypingIndicator = () => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const { session } = useAuth();

  useEffect(() => {
    fetchTypingUsers();
    fetchProfiles();

    const channel = supabase
      .channel('typing-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators'
        },
        () => {
          fetchTypingUsers();
        }
      )
      .subscribe();

    // Clean up stale typing indicators every 5 seconds
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        return prev.filter(u => {
          const updatedAt = new Date(u.updated_at).getTime();
          // Remove if older than 5 seconds
          return now - updatedAt < 5000;
        });
      });
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchTypingUsers = async () => {
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    const { data } = await supabase
      .from('typing_indicators')
      .select('*')
      .eq('is_typing', true)
      .gte('updated_at', fiveSecondsAgo);

    if (data) {
      setTypingUsers(data as TypingUser[]);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('session_id, username');

    if (data) {
      const profileMap: Record<string, string> = {};
      (data as Profile[]).forEach(p => {
        profileMap[p.session_id] = p.username;
      });
      setProfiles(profileMap);
    }
  };

  // Filter out current user
  const otherTyping = typingUsers.filter(u => u.session_id !== session?.id);

  if (otherTyping.length === 0) return null;

  const names = otherTyping
    .map(u => profiles[u.session_id] || 'Someone')
    .slice(0, 3);

  let text = '';
  if (names.length === 1) {
    text = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing...`;
  } else if (names.length >= 3) {
    text = `${names[0]}, ${names[1]} and others are typing...`;
  }

  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2 py-1 px-2 animate-fade-in">
      <span className="flex gap-1">
        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
      </span>
      <span>{text}</span>
    </div>
  );
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Send, Users, Undo2, Trash2, EyeOff, Shield, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { TypingIndicator } from '@/components/TypingIndicator';

interface ChatMessage {
  id: string;
  message: string;
  session_id: string;
  created_at: string;
  deleted_at?: string | null;
  hidden_for_session_ids?: string[];
}

interface SystemMessage {
  id: string;
  type: 'system';
  message: string;
  created_at: string;
}

type DisplayMessage = (ChatMessage & { type?: 'user' }) | SystemMessage;

interface Profile {
  session_id: string;
  username: string;
}

interface SessionRole {
  session_id: string;
  role: 'user' | 'admin' | 'owner';
}

const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [sessionRoles, setSessionRoles] = useState<Record<string, 'user' | 'admin' | 'owner'>>({});
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { session, isAdmin, isOwner } = useAuth();
  const { toast } = useToast();

  // Owner or admin can delete messages
  const canModerate = isAdmin || isOwner;

  useEffect(() => {
    fetchMessages();
    fetchProfiles();
    fetchSessionRoles();
    
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMsg]);
          if (!profiles[newMsg.session_id]) {
            fetchProfileForSession(newMsg.session_id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      setOnlineCount(Math.floor(Math.random() * 5) + 1);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (data) setMessages(data as ChatMessage[]);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('session_id, username');
    
    if (data) {
      const profileMap: Record<string, string> = {};
      data.forEach(p => {
        profileMap[p.session_id] = p.username;
      });
      setProfiles(profileMap);
    }
  };

  const fetchSessionRoles = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('id, role');
    
    if (data) {
      const rolesMap: Record<string, 'user' | 'admin' | 'owner'> = {};
      data.forEach((s: { id: string; role: 'user' | 'admin' | 'owner' }) => {
        rolesMap[s.id] = s.role;
      });
      setSessionRoles(rolesMap);
    }
  };

  const fetchProfileForSession = async (sessionId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (data?.username) {
      setProfiles(prev => ({ ...prev, [sessionId]: data.username }));
    }
  };

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) return;

    try {
      await supabase.functions.invoke('typing-indicator', {
        body: { device_id: deviceId, is_typing: typing }
      });
    } catch (error) {
      // Silently fail - typing indicator is non-critical
    }
  }, []);

  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 3000);
  }, [isTyping, updateTypingStatus]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !session) return;

    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      console.error('No device ID found');
      return;
    }

    // Stop typing indicator
    setIsTyping(false);
    updateTypingStatus(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      const response = await supabase.functions.invoke('send-chat-message', {
        body: { message: newMessage.trim(), device_id: deviceId }
      });

      if (response.error || response.data?.error) {
        toast({
          title: "Error",
          description: response.data?.error || "Failed to send message",
          variant: "destructive"
        });
        return;
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleUndo = async (messageId: string) => {
    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) return;

    try {
      const response = await supabase.functions.invoke('delete-message', {
        body: { message_id: messageId, device_id: deviceId, action: 'undo' }
      });

      if (response.error || response.data?.error) {
        toast({
          title: "Cannot undo",
          description: response.data?.error || "Failed to undo message",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Message undone",
        description: "Your message has been removed for everyone"
      });
    } catch (error) {
      console.error('Error undoing message:', error);
    }
  };

  const handleHide = async (messageId: string) => {
    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) return;

    try {
      const response = await supabase.functions.invoke('delete-message', {
        body: { message_id: messageId, device_id: deviceId, action: 'hide' }
      });

      if (response.error || response.data?.error) {
        toast({
          title: "Error",
          description: response.data?.error || "Failed to hide message",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Message hidden",
        description: "This message is now hidden for you"
      });
    } catch (error) {
      console.error('Error hiding message:', error);
    }
  };

  const handleAdminDelete = async (messageId: string) => {
    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) return;

    try {
      const response = await supabase.functions.invoke('delete-message', {
        body: { message_id: messageId, device_id: deviceId, action: 'delete' }
      });

      if (response.error || response.data?.error) {
        toast({
          title: "Error",
          description: response.data?.error || "Failed to delete message",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Message deleted",
        description: "Message removed for everyone"
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUserName = (sessionId: string) => {
    return profiles[sessionId] || 'Anonymous';
  };

  const getUserRole = (sessionId: string) => {
    return sessionRoles[sessionId] || 'user';
  };

  // Get user's own recent message IDs (last 3)
  const getOwnRecentMessageIds = () => {
    if (!session) return [];
    const ownMessages = messages
      .filter(m => m.session_id === session.id && !m.deleted_at)
      .slice(-3)
      .map(m => m.id);
    return ownMessages;
  };

  const ownRecentIds = getOwnRecentMessageIds();

  // Filter out deleted and hidden messages
  const visibleMessages = messages.filter(msg => {
    if (msg.deleted_at) return false;
    if (session && msg.hidden_for_session_ids?.includes(session.id)) return false;
    return true;
  });

  // Create display messages with system welcome message
  const displayMessages: DisplayMessage[] = [
    {
      id: 'system-welcome',
      type: 'system',
      message: 'Welcome to the Game Zone chat! 🎮',
      created_at: new Date(0).toISOString()
    },
    ...(session && profiles[session.id] ? [{
      id: 'system-join',
      type: 'system' as const,
      message: `${profiles[session.id]} joined the chat!`,
      created_at: new Date(1).toISOString()
    }] : []),
    ...visibleMessages.map(msg => ({ ...msg, type: 'user' as const }))
  ];

  const getRoleBadge = (role: 'user' | 'admin' | 'owner') => {
    if (role === 'owner') {
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-purple-500 text-purple-500 bg-purple-500/10">
          <Crown className="h-2.5 w-2.5 mr-0.5" />
          Owner
        </Badge>
      );
    }
    if (role === 'admin') {
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-500 bg-amber-500/10">
          <Shield className="h-2.5 w-2.5 mr-0.5" />
          Admin
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="h-screen flex flex-col animate-fade-in bg-black/95">
      {/* Announcements */}
      <div className="p-4 pb-0 shrink-0">
        <AnnouncementBanner />
      </div>

      {/* Console Header */}
      <div className="p-4 border-b border-primary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono text-primary">Game Zone Console</h1>
              <p className="text-primary/60 text-xs font-mono">~/chat --global</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-primary/70 font-mono">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <Users className="h-4 w-4" />
            <span>{onlineCount} online</span>
          </div>
        </div>
      </div>

      {/* Console Messages */}
      <ScrollArea className="flex-1 p-4 bg-black/50" ref={scrollRef}>
        <div className="space-y-1 font-mono text-sm">
          {displayMessages.length === 0 ? (
            <div className="text-center text-primary/50 py-12">
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-mono">Waiting for input...</p>
            </div>
          ) : (
            displayMessages.map((msg) => {
              // System message
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-primary/80 py-1">
                    <span className="text-yellow-500">System:</span>{' '}
                    <span className="text-primary/90">{msg.message}</span>
                  </div>
                );
              }

              // User message
              const chatMsg = msg as ChatMessage;
              const isOwn = chatMsg.session_id === session?.id;
              const userName = getUserName(chatMsg.session_id);
              const userColor = generateColor(chatMsg.session_id);
              const senderRole = getUserRole(chatMsg.session_id);
              const canUndo = isOwn && ownRecentIds.includes(chatMsg.id);
              
              return (
                <div key={chatMsg.id} className="group py-1 hover:bg-primary/5 px-2 -mx-2 rounded flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground">[{formatTime(chatMsg.created_at)}]</span>{' '}
                    <span style={{ color: userColor }} className="font-semibold">
                      {userName}
                    </span>
                    {getRoleBadge(senderRole) && (
                      <span className="ml-1 inline-flex">{getRoleBadge(senderRole)}</span>
                    )}
                    <span className="text-muted-foreground">:</span>{' '}
                    <span className="text-foreground break-words">{chatMsg.message}</span>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                    {canUndo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-primary"
                        onClick={() => handleUndo(chatMsg.id)}
                        title="Undo (remove for everyone)"
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    )}
                    {!isOwn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-primary"
                        onClick={() => handleHide(chatMsg.id)}
                        title="Hide for me"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    )}
                    {canModerate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => handleAdminDelete(chatMsg.id)}
                        title="Delete for everyone"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Typing Indicator */}
      <TypingIndicator />

      {/* Console Input */}
      <div className="p-4 border-t border-primary/30 shrink-0 bg-black/50">
        <div className="flex gap-2 items-center font-mono">
          <span className="text-primary shrink-0">&gt;_</span>
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              if (e.target.value.trim()) {
                handleTyping();
              }
            }}
            onKeyPress={handleKeyPress}
            placeholder="Enter message..."
            className="flex-1 bg-transparent border-primary/30 text-foreground placeholder:text-muted-foreground font-mono focus-visible:ring-primary/50"
            maxLength={500}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!newMessage.trim()} 
            size="icon"
            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

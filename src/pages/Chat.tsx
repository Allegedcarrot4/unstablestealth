import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  message: string;
  session_id: string;
  created_at: string;
}

interface Profile {
  session_id: string;
  username: string;
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
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();

  useEffect(() => {
    fetchMessages();
    fetchProfiles();
    
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
          setMessages(prev => [...prev, payload.new as ChatMessage]);
          // Fetch profile for new message sender if not cached
          const newMsg = payload.new as ChatMessage;
          if (!profiles[newMsg.session_id]) {
            fetchProfileForSession(newMsg.session_id);
          }
        }
      )
      .subscribe();

    // Simulate online count
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
    
    if (data) setMessages(data);
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !session) return;

    // Get device_id from localStorage for server-side verification
    const deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      console.error('No device ID found');
      return;
    }

    try {
      // Use edge function for secure message insertion (prevents impersonation)
      const response = await supabase.functions.invoke('send-chat-message', {
        body: { message: newMessage.trim(), device_id: deviceId }
      });

      if (response.error) {
        console.error('Failed to send message:', response.error);
        return;
      }

      if (response.data?.error) {
        console.error('Message error:', response.data.error);
        return;
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
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

  return (
    <div className="h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono text-primary">Global Chat</h1>
              <p className="text-muted-foreground text-xs">Chat with everyone online</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{onlineCount} online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.session_id === session?.id;
              const userName = getUserName(msg.session_id);
              const userColor = generateColor(msg.session_id);
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary text-secondary-foreground rounded-bl-md'
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-xs font-medium mb-1" style={{ color: userColor }}>
                        {userName}
                      </p>
                    )}
                    <p className="text-sm break-words">{msg.message}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            maxLength={500}
          />
          <Button onClick={sendMessage} disabled={!newMessage.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

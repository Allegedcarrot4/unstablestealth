import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  session_id: string;
  message: string;
  created_at: string;
}

export const GlobalChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data) {
        setMessages(data);
      }
    };

    loadMessages();

    // Subscribe to realtime updates
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !session?.id || isLoading) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: session.id,
        message: newMessage.trim()
      });

    if (!error) {
      setNewMessage('');
    }
    setIsLoading(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSessionName = (sessionId: string) => {
    // Generate a consistent color/name based on session ID
    const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `User ${hash % 1000}`;
  };

  const getSessionColor = (sessionId: string) => {
    const colors = [
      'text-red-400',
      'text-green-400',
      'text-blue-400',
      'text-yellow-400',
      'text-purple-400',
      'text-pink-400',
      'text-cyan-400',
      'text-orange-400',
    ];
    const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
          isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 h-[500px] bg-card border border-border rounded-lg shadow-2xl flex flex-col animate-fade-in">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-sm">Global Chat</span>
            <span className="text-xs text-muted-foreground ml-auto">{messages.length} messages</span>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-3">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.session_id === session?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col",
                        isOwn && "items-end"
                      )}
                    >
                      <div className={cn(
                        "flex items-center gap-1 text-xs mb-1",
                        isOwn && "flex-row-reverse"
                      )}>
                        <span className={cn("font-mono", getSessionColor(msg.session_id))}>
                          {isOwn ? 'You' : getSessionName(msg.session_id)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <div className={cn(
                        "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                        isOwn 
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-secondary rounded-tl-none"
                      )}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2 shrink-0">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 h-9 text-sm"
              maxLength={500}
            />
            <Button type="submit" size="sm" disabled={!newMessage.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};
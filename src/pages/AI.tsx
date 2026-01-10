import { useState } from 'react';
import { Send, Sparkles, Crown, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIModel {
  id: string;
  name: string;
  cost: string;
}

// Cheapest model for regular users
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

// All available models with costs for admins/owners
const AVAILABLE_MODELS: AIModel[] = [
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini Flash Lite', cost: '$0.01/1K' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini Flash', cost: '$0.02/1K' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini Pro', cost: '$0.10/1K' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', cost: '$0.15/1K' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', cost: '$0.05/1K' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', cost: '$0.15/1K' },
  { id: 'openai/gpt-5', name: 'GPT-5', cost: '$0.50/1K' },
];

const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// NOTE: Usage limits are now enforced SERVER-SIDE in the ai-chat edge function.
// The server will return a 429 error when weekly limit is exceeded.

export const AI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS[0]);
  const { toast } = useToast();
  const { isAdmin, isOwner } = useAuth();

  // Owners have unlimited access
  const hasUnlimitedAccess = isOwner;

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isLimitReached) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const device_id = getDeviceId();
      
      // Build the messages array for Gemini format
      const geminiMessages = [
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        {
          role: 'user',
          parts: [{ text: userMessage.content }]
        }
      ];

      // Premium users (admin/owner) can choose model, regular users get cheapest
      const hasPremiumAccess = isAdmin || isOwner;
      const modelToUse = hasPremiumAccess ? selectedModel.id : DEFAULT_MODEL;

      // Call the secure edge function (limits enforced server-side)
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: geminiMessages, device_id, model: modelToUse }
      });

      if (error) {
        throw new Error(error.message || 'Failed to get response');
      }

      // Check for limit_reached flag from server
      if (data?.limit_reached) {
        setIsLimitReached(true);
        throw new Error(data.error);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received'
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('AI error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
      // Remove the user message if we failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Premium model selector for admins and owners */}
          {(isAdmin || isOwner) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Crown className={cn("h-4 w-4", isOwner ? "text-purple-500" : "text-yellow-500")} />
                  {selectedModel.name}
                  <span className="text-xs text-muted-foreground">({selectedModel.cost})</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {AVAILABLE_MODELS.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className={cn(
                      "flex justify-between gap-4",
                      selectedModel.id === model.id && "bg-primary/10"
                    )}
                  >
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.cost}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Role indicator */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono",
            hasUnlimitedAccess 
              ? "bg-purple-500/10 text-purple-500"
              : isAdmin
                ? "bg-yellow-500/10 text-yellow-500"
                : isLimitReached
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
          )}>
            {hasUnlimitedAccess ? (
              <>
                <Crown className="h-4 w-4" />
                Unlimited
              </>
            ) : isAdmin ? (
              <>
                <Crown className="h-4 w-4" />
                Admin (10/week)
              </>
            ) : (
              <span>{isLimitReached ? 'Limit reached' : 'User (5/week)'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {hasUnlimitedAccess 
                  ? "Ask me anything! You have unlimited messages as an owner."
                  : isAdmin
                    ? "Ask me anything! You have 10 questions per week."
                    : "Ask me anything! You have 5 questions per week."
                }
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "p-4 rounded-lg max-w-[80%]",
                msg.role === 'user' 
                  ? "bg-primary/10 ml-auto" 
                  : "bg-secondary mr-auto"
              )}
            >
              <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {isLoading && (
            <div className="bg-secondary p-4 rounded-lg max-w-[80%] mr-auto">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={isLimitReached && !hasUnlimitedAccess ? "Weekly limit reached" : "Ask something..."}
          disabled={isLoading || (isLimitReached && !hasUnlimitedAccess)}
          className="flex-1"
        />
        <Button 
          onClick={sendMessage} 
          disabled={isLoading || !input.trim() || (isLimitReached && !hasUnlimitedAccess)}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
import { useState, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Crown, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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

const DAILY_LIMIT = 10;
const STORAGE_KEY = 'ai_daily_usage';

// Cheapest model for regular users
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

// All available models with costs for admins
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

const getUsageData = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { date: new Date().toDateString(), count: 0 };
  
  const data = JSON.parse(stored);
  // Reset if it's a new day
  if (data.date !== new Date().toDateString()) {
    return { date: new Date().toDateString(), count: 0 };
  }
  return data;
};

const saveUsageData = (count: number) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: new Date().toDateString(),
    count
  }));
};

export const AI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS[0]);
  const { toast } = useToast();

  useEffect(() => {
    const usage = getUsageData();
    setQuestionsUsed(usage.count);
    
    // Check if user is admin
    const checkAdmin = async () => {
      const deviceId = getDeviceId();
      const { data: session } = await supabase
        .from('sessions')
        .select('role')
        .eq('device_id', deviceId)
        .single();
      
      if (session?.role === 'admin') {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, []);

  // Admins have unlimited, regular users have daily limit
  const questionsRemaining = isAdmin ? Infinity : DAILY_LIMIT - questionsUsed;

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!isAdmin && questionsRemaining <= 0) {
      toast({
        title: "Daily limit reached",
        description: "You've used all 10 questions for today. Come back tomorrow!",
        variant: "destructive"
      });
      return;
    }

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

      // Admins can choose model, regular users get cheapest
      const modelToUse = isAdmin ? selectedModel.id : DEFAULT_MODEL;

      // Call the secure edge function
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: geminiMessages, device_id, model: modelToUse }
      });

      if (error) {
        throw new Error(error.message || 'Failed to get response');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received'
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Only track usage for non-admins
      if (!isAdmin) {
        const newCount = questionsUsed + 1;
        setQuestionsUsed(newCount);
        saveUsageData(newCount);
      }

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
          {/* Admin model selector */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
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
          
          {/* Usage indicator */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono",
            isAdmin 
              ? "bg-yellow-500/10 text-yellow-500"
              : questionsRemaining > 3 
                ? "bg-primary/10 text-primary" 
                : questionsRemaining > 0 
                  ? "bg-yellow-500/10 text-yellow-500"
                  : "bg-destructive/10 text-destructive"
          )}>
            {isAdmin ? (
              <>
                <Crown className="h-4 w-4" />
                Unlimited
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                {questionsRemaining}/{DAILY_LIMIT} left
              </>
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
                {isAdmin 
                  ? "Ask me anything! You have unlimited messages as an admin."
                  : `Ask me anything! You have ${questionsRemaining} questions remaining today.`
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
          placeholder={isAdmin || questionsRemaining > 0 ? "Ask something..." : "Daily limit reached"}
          disabled={isLoading || (!isAdmin && questionsRemaining <= 0)}
          className="flex-1"
        />
        <Button 
          onClick={sendMessage} 
          disabled={isLoading || !input.trim() || (!isAdmin && questionsRemaining <= 0)}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

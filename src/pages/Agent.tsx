import { useState } from 'react';
import { Send, Bot, CheckCircle, XCircle, Crown, ChevronDown, Loader2 } from 'lucide-react';
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

interface AgentMessage {
  role: 'user' | 'agent';
  content: string;
  actionResult?: {
    success: boolean;
    message?: string;
    error?: string;
  } | null;
}

interface AIModel {
  id: string;
  name: string;
  cost: string;
}

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

export const Agent = () => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AVAILABLE_MODELS[1]); // Default to Gemini Flash
  const { toast } = useToast();
  const { isOwner } = useAuth();

  const sendCommand = async () => {
    if (!input.trim() || isLoading) return;

    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only owners can use the Agent.",
        variant: "destructive"
      });
      return;
    }

    const userMessage: AgentMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const device_id = getDeviceId();
      
      const { data, error } = await supabase.functions.invoke('owner-agent', {
        body: { device_id, command: userMessage.content, model: selectedModel.id }
      });

      if (error) {
        throw new Error(error.message || 'Failed to get response');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const agentMessage: AgentMessage = {
        role: 'agent',
        content: data?.message || 'No response received',
        actionResult: data?.action_executed
      };

      setMessages(prev => [...prev, agentMessage]);

      // Show toast if action was executed
      if (data?.action_executed) {
        if (data.action_executed.success) {
          toast({
            title: "Action Executed",
            description: data.action_executed.message || "Command completed successfully"
          });
        } else {
          toast({
            title: "Action Failed",
            description: data.action_executed.error || "Command failed",
            variant: "destructive"
          });
        }
      }

    } catch (error) {
      console.error('Agent error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive"
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6">
        <Crown className="h-16 w-16 text-purple-500 mb-4 opacity-50" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Owner Access Required</h1>
        <p className="text-muted-foreground">Only owners can access the Agent.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Bot className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Owner Agent</h1>
            <p className="text-sm text-muted-foreground">AI-powered admin control</p>
          </div>
        </div>
        
        {/* Model selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Crown className="h-4 w-4 text-purple-500" />
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
      </div>

      {/* Capabilities info */}
      <div className="mb-4 p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-purple-500">Commands you can give:</span> Ban/unban users, change roles, enable/disable site, list users, check status, and more.
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Give me a command and I'll execute it for you.</p>
              <p className="text-sm mt-2">Try: "Ban user john" or "Disable the site"</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "p-4 rounded-lg max-w-[85%]",
                msg.role === 'user' 
                  ? "bg-purple-500/10 ml-auto border border-purple-500/20" 
                  : "bg-secondary mr-auto"
              )}
            >
              <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
              
              {/* Action result indicator */}
              {msg.actionResult && (
                <div className={cn(
                  "mt-3 pt-3 border-t flex items-center gap-2 text-sm",
                  msg.actionResult.success 
                    ? "border-green-500/30 text-green-500" 
                    : "border-destructive/30 text-destructive"
                )}>
                  {msg.actionResult.success ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Action executed: {msg.actionResult.message}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      <span>Action failed: {msg.actionResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="bg-secondary p-4 rounded-lg max-w-[80%] mr-auto flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span className="text-sm text-muted-foreground">Processing command...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendCommand()}
          placeholder="Enter a command for the agent..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button 
          onClick={sendCommand} 
          disabled={isLoading || !input.trim()}
          size="icon"
          className="bg-purple-500 hover:bg-purple-600"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
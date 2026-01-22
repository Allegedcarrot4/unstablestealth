import { useState, useRef } from 'react';
import { Search, ArrowLeft, ArrowRight, RefreshCw, PlayCircle, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const quickLinks = [
  { name: 'Google', url: 'https://google.com', icon: Search, color: 'text-blue-400' },
  { name: 'YouTube', url: 'https://youtube.com', icon: PlayCircle, color: 'text-red-400' },
  { name: 'Discord', url: 'https://discord.com', icon: MessageCircle, color: 'text-indigo-400' },
];

const PROXY_BASE = 'https://scramjet.mercurywork.shop/main/';
const PROXY_HOME = 'https://scramjet.mercurywork.shop/';

// Custom encoding function for Scramjet proxy
const encodeScramjet = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return PROXY_HOME;

  // Check if it's a valid URL pattern (starts with http or has common TLD)
  const urlPattern = /^(https?:\/\/)|(\w+\.(com|org|net|io|dev|gg|app|edu|gov|co|me|tv|xyz|info))/i;

  let finalUrl: string;
  if (urlPattern.test(trimmed)) {
    // Valid URL - add https if missing
    finalUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  } else {
    // Treat as Google search
    finalUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  return `${PROXY_BASE}${encodeURIComponent(finalUrl)}`;
};

export const Proxy = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [proxyUrl, setProxyUrl] = useState(PROXY_HOME);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = () => {
    setIsLoading(true);
    setLoadProgress(0);
    
    // Simulate progress
    progressIntervalRef.current = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);
  };

  const stopLoading = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setLoadProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setLoadProgress(0);
    }, 300);
  };

  const handleGo = () => {
    const processed = encodeScramjet(inputUrl);
    startLoading();
    setProxyUrl(processed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGo();
    }
  };

  const handleQuickLink = (url: string) => {
    setInputUrl(url);
    startLoading();
    setProxyUrl(encodeScramjet(url));
  };

  const handleClear = () => {
    setInputUrl('');
    startLoading();
    setProxyUrl(PROXY_HOME);
  };

  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      // Cross-origin restriction
    }
  };

  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      // Cross-origin restriction
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      startLoading();
      iframeRef.current.src = proxyUrl;
    }
  };

  const handleIframeLoad = () => {
    stopLoading();
  };

  const isHome = proxyUrl === PROXY_HOME;

  return (
    <div className="h-screen flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center gap-2 p-2 bg-background border-b border-border relative">
        {/* Progress Bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1">
            <Progress value={loadProgress} className="h-1 rounded-none" />
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-9 w-9 hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleForward}
            className="h-9 w-9 hover:bg-secondary"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className={cn("h-9 w-9 hover:bg-secondary", isLoading && "animate-spin")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter URL or search term..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10 glass focus:neon-glow"
            />
            {inputUrl && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleGo} className="px-6">
            Go
          </Button>
        </div>

        {/* Quick Access Buttons */}
        <div className="hidden md:flex items-center gap-1">
          {quickLinks.map((link) => (
            <Button
              key={link.name}
              variant="ghost"
              size="sm"
              onClick={() => handleQuickLink(link.url)}
              className="gap-1.5"
            >
              <link.icon className={cn("h-4 w-4", link.color)} />
              <span className="text-xs">{link.name}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Iframe - Full Screen */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src={proxyUrl}
          className="w-full h-full"
          allow="fullscreen; allow-forms; allow-scripts; allow-same-origin"
          frameBorder={0}
          title="Proxy Browser"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
};

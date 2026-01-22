import { useState, useRef } from 'react';
import { Search, ArrowLeft, ArrowRight, RefreshCw, PlayCircle, MessageCircle, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const quickLinks = [
  { name: 'Google', url: 'https://google.com', icon: Search, color: 'text-blue-400' },
  { name: 'YouTube', url: 'https://youtube.com', icon: PlayCircle, color: 'text-red-400' },
  { name: 'Discord', url: 'https://discord.com', icon: MessageCircle, color: 'text-indigo-400' },
  { name: 'GitHub', url: 'https://github.com', icon: Github, color: 'text-gray-400' },
];

const PROXY_BASE = 'https://scramjet-app-unstable.vercel.app/';

export const Proxy = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const processUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Check if it's a valid URL pattern
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-./?%&=@#]*)?$/i;

    if (urlPattern.test(trimmed)) {
      // Valid URL - add https if missing
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      return `${PROXY_BASE}${url}`;
    } else {
      // Treat as Google search
      const searchQuery = encodeURIComponent(trimmed);
      return `${PROXY_BASE}https://www.google.com/search?q=${searchQuery}`;
    }
  };

  const handleGo = () => {
    const processed = processUrl(inputUrl);
    if (processed) {
      setIsLoading(true);
      setProxyUrl(processed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGo();
    }
  };

  const handleQuickLink = (url: string) => {
    setInputUrl(url);
    setIsLoading(true);
    setProxyUrl(`${PROXY_BASE}${url}`);
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
    if (iframeRef.current && proxyUrl) {
      setIsLoading(true);
      iframeRef.current.src = proxyUrl;
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex items-center gap-2">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            disabled={!proxyUrl}
            className="h-9 w-9 hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleForward}
            disabled={!proxyUrl}
            className="h-9 w-9 hover:bg-secondary"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={!proxyUrl}
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
              className="pl-10 glass focus:neon-glow"
            />
          </div>
          <Button onClick={handleGo} className="px-6">
            Go
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 rounded-lg border border-border overflow-hidden bg-background relative">
        {!proxyUrl ? (
          /* Home Screen */
          <div className="h-full flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold font-mono text-primary text-glow">Web Browser</h2>
              <p className="text-muted-foreground">Enter a URL or search term to start browsing</p>
            </div>

            {/* Quick Links Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
              {quickLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleQuickLink(link.url)}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg bg-secondary border border-border hover:border-primary/50 hover:neon-glow transition-all duration-200 group"
                >
                  <link.icon className={cn("h-8 w-8 transition-transform group-hover:scale-110", link.color)} />
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {link.name}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Browse anonymously through the proxy
            </p>
          </div>
        ) : (
          /* Iframe */
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="animate-pulse text-primary font-mono">Loading...</div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={proxyUrl}
              className="w-full h-full"
              allow="fullscreen; allow-forms; allow-scripts; allow-same-origin"
              frameBorder={0}
              title="Proxy Browser"
              onLoad={handleIframeLoad}
            />
          </>
        )}
      </div>
    </div>
  );
};

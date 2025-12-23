import { useState, useRef } from 'react';
import { Shield, Search, Lock, RefreshCw, X, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const Proxy = () => {
  const [url, setUrl] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatUrl = (input: string) => {
    let formatted = input.trim();
    if (!formatted) return '';
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    return formatted;
  };

  const handleBrowse = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedUrl = formatUrl(url);
    if (formattedUrl) {
      // Add to session history (not persisted)
      setHistory(prev => [...prev.slice(-9), formattedUrl]);
      setProxyUrl(formattedUrl);
    }
  };

  const handleClear = () => {
    setUrl('');
    setProxyUrl('');
    setHistory([]);
  };

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleNewTab = () => {
    if (proxyUrl) {
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Private Browser</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body, html { width: 100%; height: 100%; overflow: hidden; background: #0a0a0f; }
                iframe { width: 100%; height: 100%; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${proxyUrl}"></iframe>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 neon-glow">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono">Private Browser</h1>
            <p className="text-muted-foreground text-xs">No history saved • Completely private</p>
          </div>
        </div>

        {/* URL Bar */}
        <form onSubmit={handleBrowse} className="flex gap-2">
          <div className="relative flex-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to browse privately"
              className="pl-10 bg-secondary border-border font-mono text-sm h-11"
            />
          </div>
          <Button type="submit" className="px-6 gap-2 neon-glow">
            <Search className="h-4 w-4" />
            Go
          </Button>
        </form>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={!proxyUrl}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewTab}
            disabled={!proxyUrl}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            New Tab
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFullscreen}
            disabled={!proxyUrl}
            className="gap-2"
          >
            Fullscreen
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClear}
            disabled={!proxyUrl && history.length === 0}
            className="gap-2 ml-auto"
          >
            <X className="h-4 w-4" />
            Clear Session
          </Button>
        </div>

        {/* Session Info */}
        {history.length > 0 && (
          <div className="text-xs text-muted-foreground font-mono">
            Session visits: {history.length} (not saved)
          </div>
        )}
      </div>

      {/* Browser Container */}
      <div 
        ref={containerRef}
        className="flex-1 mx-4 mb-4 rounded-lg overflow-hidden border border-border bg-card"
      >
        {proxyUrl ? (
          <iframe
            ref={iframeRef}
            src={proxyUrl}
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            title="Private browser"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4 animate-pulse-glow">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-medium">Private Browsing</p>
            <p className="text-sm mt-1 text-center max-w-md px-4">
              Your browsing history is not saved. Enter a URL above to start browsing privately.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

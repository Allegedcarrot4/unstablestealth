import { useState, useRef, useCallback } from 'react';
import { Search, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmbedControls } from '@/components/EmbedControls';

export const Embedder = () => {
  const [url, setUrl] = useState('');
  const [embeddedUrl, setEmbeddedUrl] = useState('');
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

  const handleEmbed = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedUrl = formatUrl(url);
    if (formattedUrl) {
      setEmbeddedUrl(formattedUrl);
    }
  };

  const handleClear = () => {
    setUrl('');
    setEmbeddedUrl('');
  };

  const handleNewTab = useCallback(() => {
    if (embeddedUrl) {
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>New Tab</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body, html { width: 100%; height: 100%; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${embeddedUrl}"></iframe>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    }
  }, [embeddedUrl]);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleBack = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.back();
    }
  };

  const handleForward = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.forward();
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* URL Bar */}
      <div className="p-4 space-y-4">
        <form onSubmit={handleEmbed} className="flex gap-2">
          <div className="relative flex-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to embed (e.g., google.com)"
              className="pl-10 bg-secondary border-border font-mono text-sm h-11 focus:ring-primary focus:border-primary"
            />
          </div>
          <Button type="submit" className="px-6 gap-2 neon-glow">
            <Search className="h-4 w-4" />
            Go
          </Button>
        </form>

        <EmbedControls
          onClear={handleClear}
          onNewTab={handleNewTab}
          onFullscreen={handleFullscreen}
          onReload={handleReload}
          onBack={handleBack}
          onForward={handleForward}
          hasUrl={!!embeddedUrl}
        />
      </div>

      {/* Embed Container */}
      <div 
        ref={containerRef}
        className="flex-1 mx-4 mb-4 rounded-lg overflow-hidden border border-border bg-card"
      >
        {embeddedUrl ? (
          <iframe
            ref={iframeRef}
            src={embeddedUrl}
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            title="Embedded content"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4 neon-glow">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-medium">Enter a URL to get started</p>
            <p className="text-sm mt-1">Your browsing will be embedded in about:blank</p>
          </div>
        )}
      </div>
    </div>
  );
};

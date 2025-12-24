import { useState, useRef } from 'react';
import { Chrome, Search, Lock, RefreshCw, X, ExternalLink, Maximize } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmbedControls } from '@/components/EmbedControls';

export const Browser = () => {
  const [url, setUrl] = useState('');
  const [browserUrl, setBrowserUrl] = useState('');
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
      setHistory(prev => [...prev, formattedUrl]);
      setBrowserUrl(formattedUrl);
    }
  };

  const handleClear = () => {
    setUrl('');
    setBrowserUrl('');
  };

  const handleNewTab = () => {
    if (browserUrl) {
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Blink Browser</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body, html { width: 100%; height: 100%; overflow: hidden; background: #0a0a0f; }
                iframe { width: 100%; height: 100%; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${browserUrl}"></iframe>
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
    <div className="h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-3 space-y-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <Chrome className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-blue-400">Blink Browser</h1>
            <p className="text-muted-foreground text-xs">Powered by Chromium Open Source Project</p>
          </div>
        </div>

        {/* URL Bar */}
        <form onSubmit={handleBrowse} className="flex gap-2">
          <div className="relative flex-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to browse"
              className="pl-10 bg-secondary border-border font-mono text-sm h-11"
            />
          </div>
          <Button type="submit" className="px-6 gap-2 bg-blue-600 hover:bg-blue-700">
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
          hasUrl={!!browserUrl}
        />
      </div>

      {/* Browser Container - takes remaining space */}
      <div 
        ref={containerRef}
        className="flex-1 mx-3 mb-3 rounded-lg overflow-hidden border border-border bg-card min-h-0"
      >
        {browserUrl ? (
          <iframe
            ref={iframeRef}
            src={browserUrl}
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            title="Blink browser"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/30">
              <Chrome className="h-12 w-12 text-blue-400" />
            </div>
            <p className="text-lg font-medium text-blue-400">Blink Browser</p>
            <p className="text-sm mt-1 text-center max-w-md px-4">
              Open source browser powered by Chromium's Blink engine
            </p>
            <p className="text-xs mt-3 text-muted-foreground/60">
              History is saved during your session
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
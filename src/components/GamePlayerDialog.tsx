import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Maximize, Minimize, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Game {
  id: string;
  title: string;
  source_code: string;
  image_url: string | null;
  created_at: string;
}

interface GamePlayerDialogProps {
  game: Game | null;
  onClose: () => void;
}

export function GamePlayerDialog({ game, onClose }: GamePlayerDialogProps) {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-fullscreen when game is selected
  useEffect(() => {
    if (game && gameContainerRef.current) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        gameContainerRef.current?.requestFullscreen().catch((err) => {
          console.error('Auto-fullscreen failed:', err);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [game]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // If exiting fullscreen, close the player
      if (!isNowFullscreen && game) {
        onClose();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [game, onClose]);

  const handleFullscreen = () => {
    if (!gameContainerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      gameContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Fullscreen failed:', err);
      });
    }
  };

  const handleClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    onClose();
  };

  if (!game) return null;

  return (
    <div
      ref={gameContainerRef}
      className="fixed inset-0 z-[9999] bg-background"
      style={{
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Game content */}
      <div
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: game.source_code }}
      />

      {/* Floating controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleFullscreen}
              className="h-9 w-9 bg-background/80 backdrop-blur-sm hover:bg-background border border-border shadow-lg"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground border border-border shadow-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Close</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Game title badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg z-10">
        <Gamepad2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{game.title}</span>
      </div>
    </div>
  );
}

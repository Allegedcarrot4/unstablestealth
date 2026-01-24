import { Gamepad2, X } from 'lucide-react';
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
  if (!game) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Game content - using iframe for better isolation */}
      <iframe
        srcDoc={game.source_code}
        className="w-full h-full border-0"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
        allow="fullscreen"
      />

      {/* Floating close button */}
      <div className="absolute top-3 right-3 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onClose}
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

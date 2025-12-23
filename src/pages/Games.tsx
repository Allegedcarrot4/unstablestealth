import { useState } from 'react';
import { Gamepad2, Play, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Game {
  id: string;
  name: string;
  embedUrl: string;
  thumbnail: string;
  description: string;
}

const games: Game[] = [
  {
    id: 'yohoho',
    name: 'YoHoHo.io',
    embedUrl: 'https://www.crazygames.com/embed/yohoho-io',
    thumbnail: 'https://images.crazygames.com/yohoho-io/20210927074109/yohoho-io-cover?auto=format%2Ccompress&q=45&cs=strip&ch=DPR&w=400',
    description: 'Battle royale pirate game',
  },
  {
    id: 'polytrack',
    name: 'Polytrack',
    embedUrl: 'https://www.crazygames.com/embed/polytrack',
    thumbnail: 'https://images.crazygames.com/polytrack/20240313121135/polytrack-cover?auto=format%2Ccompress&q=45&cs=strip&ch=DPR&w=400',
    description: 'Low-poly racing game',
  },
  {
    id: 'smashyroad',
    name: 'Smashy Road 2',
    embedUrl: 'https://www.crazygames.com/embed/smashy-road-wanted-2',
    thumbnail: 'https://images.crazygames.com/smashy-road-wanted-2/20220928135645/smashy-road-wanted-2-cover?auto=format%2Ccompress&q=45&cs=strip&ch=DPR&w=400',
    description: 'Car chase action game',
  },
  {
    id: 'drivemad',
    name: 'Drive Mad',
    embedUrl: 'https://www.crazygames.com/embed/drive-mad',
    thumbnail: 'https://images.crazygames.com/drive-mad/20221212035339/drive-mad-cover?auto=format%2Ccompress&q=45&cs=strip&ch=DPR&w=400',
    description: 'Physics-based driving game',
  },
];

export const Games = () => {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const handlePlayInNewTab = (game: Game) => {
    const newWindow = window.open('about:blank', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${game.name}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body, html { width: 100%; height: 100%; overflow: hidden; background: #0a0a0f; }
              iframe { width: 100%; height: 100%; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${game.embedUrl}" allowfullscreen></iframe>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  return (
    <div className="h-full animate-fade-in">
      {selectedGame ? (
        <div className="h-full flex flex-col">
          {/* Game Header */}
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <h2 className="font-mono font-bold text-lg">{selectedGame.name}</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePlayInNewTab(selectedGame)}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                New Tab
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedGame(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Game Iframe */}
          <div className="flex-1 bg-card">
            <iframe
              src={selectedGame.embedUrl}
              className="w-full h-full"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
              title={selectedGame.name}
            />
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10 neon-glow">
              <Gamepad2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono">Games</h1>
              <p className="text-muted-foreground text-sm">Play games stealthily in about:blank</p>
            </div>
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {games.map((game) => (
              <div
                key={game.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border bg-card",
                  "transition-all duration-300 hover:border-primary/50 hover:neon-glow"
                )}
              >
                {/* Thumbnail */}
                <div className="aspect-video overflow-hidden">
                  <img
                    src={game.thumbnail}
                    alt={game.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-mono font-bold text-lg mb-1">{game.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{game.description}</p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedGame(game)}
                      className="flex-1 gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Play
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePlayInNewTab(game)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

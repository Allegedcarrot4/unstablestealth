import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Gamepad2, Image as ImageIcon, Code, X } from 'lucide-react';

interface Game {
  id: string;
  title: string;
  source_code: string;
  image_url: string | null;
  created_at: string;
}

const getDeviceId = () => {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

export default function Games() {
  const { session, isOwner } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGames();

    const channel = supabase
      .channel('games-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        fetchGames();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGames = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch games:', error);
    } else {
      setGames(data || []);
    }
    setLoading(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sourceCode.trim()) {
      toast.error('Please fill in title and source code');
      return;
    }

    setSubmitting(true);

    try {
      let imageBase64 = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      const response = await supabase.functions.invoke('manage-games', {
        body: {
          action: 'add',
          device_id: getDeviceId(),
          title: title.trim(),
          source_code: sourceCode.trim(),
          image_base64: imageBase64,
          image_filename: imageFile?.name
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Game added successfully!');
      setTitle('');
      setSourceCode('');
      clearImage();
      setAddDialogOpen(false);
      fetchGames();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add game');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      const response = await supabase.functions.invoke('manage-games', {
        body: {
          action: 'delete',
          device_id: getDeviceId(),
          game_id: gameId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Game deleted');
      fetchGames();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete game');
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please log in to view games.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Games</h1>
        </div>
        
        {isOwner && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Game
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Game</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddGame} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Game Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter game title"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Source Code (Embed/Iframe)</Label>
                  <Textarea
                    id="source"
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    placeholder='<iframe src="..." width="100%" height="400"></iframe>'
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the HTML embed code or iframe for the game
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Game Image (Optional)</Label>
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={clearImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Game'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading games...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No games available yet.</p>
          {isOwner && <p className="text-sm text-muted-foreground mt-1">Click "Add Game" to get started!</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <Card
                key={game.id}
                className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
                onClick={() => setSelectedGame(game)}
              >
                {game.image_url ? (
                  <img
                    src={game.image_url}
                    alt={game.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Gamepad2 className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="truncate">{game.title}</span>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGame(game.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Game Player Dialog */}
      <Dialog open={!!selectedGame} onOpenChange={() => setSelectedGame(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              {selectedGame?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
            <div
              className="game-embed"
              dangerouslySetInnerHTML={{ __html: selectedGame?.source_code || '' }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

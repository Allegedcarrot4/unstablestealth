import { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Code,
  FileUp,
  Gamepad2,
  Image as ImageIcon,
  Maximize,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface Game {
  id: string;
  title: string;
  source_code: string;
  image_url: string | null;
  created_at: string;
}

const getDeviceId = () => {
  // IMPORTANT: must match key in AuthContext ('deviceId' camelCase)
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

async function getInvokeErrorMessage(err: any): Promise<string> {
  // supabase-js wraps non-2xx responses in an error with a context body.
  const fallback = err?.message || 'Request failed';

  const body = err?.context?.body;
  if (typeof body === 'string' && body.trim().length > 0) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.error === 'string') return parsed.error;
      if (typeof parsed?.message === 'string') return parsed.message;
    } catch {
      return body;
    }
  }

  return fallback;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function GamePlayerDialog({ game, onClose }: { game: Game | null; onClose: () => void }) {
  const gameContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <Dialog open={!!game} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              {game?.title}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleFullscreen}
              title="Fullscreen"
              className="h-8 w-8"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div
          ref={gameContainerRef}
          className="mt-4 overflow-auto bg-background"
          style={{ maxHeight: 'calc(90vh - 120px)' }}
        >
          <div className="game-embed" dangerouslySetInnerHTML={{ __html: game?.source_code || '' }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Games() {
  const { session, isOwner } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSourceCode, setEditSourceCode] = useState('');
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // Player dialog
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Filtered games based on search
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const query = searchQuery.toLowerCase();
    return games.filter(game => game.title.toLowerCase().includes(query));
  }, [games, searchQuery]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canManage = useMemo(() => !!session && isOwner, [session, isOwner]);

  const fetchGames = async () => {
    const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch games:', error);
    } else {
      setGames(data || []);
    }
    setLoading(false);
  };

  const resetAddForm = () => {
    setTitle('');
    setSourceCode('');
    setHtmlFile(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const openEdit = (game: Game) => {
    setEditingGame(game);
    setEditTitle(game.title);
    setEditSourceCode(game.source_code);
    setEditHtmlFile(null);
    setEditImageFile(null);
    setEditImagePreview(game.image_url || null);
    setEditDialogOpen(true);
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    opts: { setFile: (f: File | null) => void; setPreview: (p: string | null) => void }
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    opts.setFile(file);
    const reader = new FileReader();
    reader.onload = () => opts.setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.html') && !lower.endsWith('.htm')) {
      toast.error('Please upload a .html file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('HTML file must be less than 2MB');
      return;
    }

    setFile(file);
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManage) {
      toast.error('Only owners can add games.');
      return;
    }

    if (!title.trim()) {
      toast.error('Please fill in the title');
      return;
    }

    if (!htmlFile && !sourceCode.trim()) {
      toast.error('Paste embed code OR upload an HTML file');
      return;
    }

    setSubmittingAdd(true);

    try {
      const imageBase64 = imageFile ? await fileToDataUrl(imageFile) : null;
      const htmlBase64 = htmlFile ? await fileToDataUrl(htmlFile) : null;

      const response = await supabase.functions.invoke('manage-games', {
        body: {
          action: 'add',
          device_id: getDeviceId(),
          title: title.trim(),
          source_code: htmlFile ? null : sourceCode.trim(),
          html_base64: htmlBase64,
          html_filename: htmlFile?.name,
          image_base64: imageBase64,
          image_filename: imageFile?.name,
        },
      });

      if (response.error) {
        throw new Error(await getInvokeErrorMessage(response.error));
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Game added successfully!');
      resetAddForm();
      setAddDialogOpen(false);
      fetchGames();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add game');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleUpdateGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManage) {
      toast.error('Only owners can edit games.');
      return;
    }

    if (!editingGame) return;

    if (!editTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }

    setSubmittingEdit(true);

    try {
      const imageBase64 = editImageFile ? await fileToDataUrl(editImageFile) : null;
      const htmlBase64 = editHtmlFile ? await fileToDataUrl(editHtmlFile) : null;

      const response = await supabase.functions.invoke('manage-games', {
        body: {
          action: 'update',
          device_id: getDeviceId(),
          game_id: editingGame.id,
          title: editTitle.trim(),
          // Only send source_code if the user didn't upload an HTML file.
          source_code: editHtmlFile ? null : editSourceCode?.trim(),
          html_base64: htmlBase64,
          html_filename: editHtmlFile?.name,
          image_base64: imageBase64,
          image_filename: editImageFile?.name,
        },
      });

      if (response.error) {
        throw new Error(await getInvokeErrorMessage(response.error));
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Game updated');
      setEditDialogOpen(false);
      setEditingGame(null);
      fetchGames();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update game');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!canManage) {
      toast.error('Only owners can delete games.');
      return;
    }

    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      const response = await supabase.functions.invoke('manage-games', {
        body: {
          action: 'delete',
          device_id: getDeviceId(),
          game_id: gameId,
        },
      });

      if (response.error) {
        throw new Error(await getInvokeErrorMessage(response.error));
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('Game deleted');
      fetchGames();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete game');
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Games</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games..."
              className="pl-9 w-full sm:w-64"
            />
          </div>

          {canManage && (
          <Dialog
            open={addDialogOpen}
            onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) resetAddForm();
            }}
          >
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="source">Embed Code (Optional)</Label>
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="text/html,.html,.htm"
                        className="hidden"
                        onChange={(e) => handleHtmlChange(e, setHtmlFile)}
                      />
                      <Button type="button" variant="secondary" className="gap-2" onClick={(e) => (e.currentTarget.previousSibling as HTMLInputElement)?.click()}>
                        <FileUp className="h-4 w-4" />
                        Upload HTML
                      </Button>
                    </label>
                  </div>

                  {htmlFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{htmlFile.name}</p>
                        <p className="text-xs text-muted-foreground">This will be hosted and embedded as an iframe.</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setHtmlFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Textarea
                        id="source"
                        value={sourceCode}
                        onChange={(e) => setSourceCode(e.target.value)}
                        placeholder='<iframe src="..." width="100%" height="600"></iframe>'
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste the HTML embed code/iframe OR upload a .html file.
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Game Image (Optional)</Label>
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Game image preview"
                        className="w-full h-40 object-cover rounded-lg border border-border"
                        loading="lazy"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleImageChange(e, {
                            setFile: setImageFile,
                            setPreview: setImagePreview,
                          })
                        }
                      />
                    </label>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submittingAdd}>
                  {submittingAdd ? 'Adding…' : 'Add Game'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading games…</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{searchQuery ? 'No games match your search.' : 'No games available yet.'}</p>
          {canManage && <p className="text-sm text-muted-foreground mt-1">Click “Add Game” to get started!</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredGames.map((game) => (
              <Card
                key={game.id}
                className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
                onClick={() => setSelectedGame(game)}
              >
                <div className="aspect-square w-full overflow-hidden">
                  {game.image_url ? (
                    <img src={game.image_url} alt={game.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Gamepad2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <span className="truncate">{game.title}</span>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(game);
                          }}
                          aria-label="Edit game"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGame(game.id);
                          }}
                          aria-label="Delete game"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit Game Dialog (owner only) */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingGame(null);
            setEditHtmlFile(null);
            setEditImageFile(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Edit Game
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateGame} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Game Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={100} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-source">Embed Code</Label>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="text/html,.html,.htm"
                    className="hidden"
                    onChange={(e) => handleHtmlChange(e, setEditHtmlFile)}
                  />
                  <Button type="button" variant="secondary" className="gap-2" onClick={(e) => (e.currentTarget.previousSibling as HTMLInputElement)?.click()}>
                    <FileUp className="h-4 w-4" />
                    Upload HTML
                  </Button>
                </label>
              </div>

              {editHtmlFile ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{editHtmlFile.name}</p>
                    <p className="text-xs text-muted-foreground">This will replace the current embed.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditHtmlFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Textarea
                  id="edit-source"
                  value={editSourceCode}
                  onChange={(e) => setEditSourceCode(e.target.value)}
                  placeholder="Paste iframe/embed HTML"
                  rows={4}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Game Image</Label>
              {editImagePreview ? (
                <div className="relative">
                  <img
                    src={editImagePreview}
                    alt="Current game image"
                    className="w-full h-40 object-cover rounded-lg border border-border"
                    loading="lazy"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => {
                      setEditImageFile(null);
                      setEditImagePreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleImageChange(e, {
                        setFile: setEditImageFile,
                        setPreview: setEditImagePreview,
                      })
                    }
                  />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Upload a new image to replace the current one.</p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={submittingEdit || !editingGame}>
                {submittingEdit ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!editingGame}
                onClick={() => editingGame && handleDeleteGame(editingGame.id)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Game Player Dialog */}
      <GamePlayerDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  );
}

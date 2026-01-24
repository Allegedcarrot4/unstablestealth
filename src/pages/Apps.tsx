import { useEffect, useMemo, useState } from 'react';
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
  AppWindow,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AppPlayerDialog } from '@/components/AppPlayerDialog';

interface App {
  id: string;
  title: string;
  source_code: string;
  image_url: string | null;
  created_at: string;
}

const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

async function getInvokeErrorMessage(err: any): Promise<string> {
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

export default function Apps() {
  const { session, isOwner } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
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
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSourceCode, setEditSourceCode] = useState('');
  const [editHtmlFile, setEditHtmlFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // Player dialog
  const [selectedApp, setSelectedApp] = useState<App | null>(null);

  // Filtered apps based on search
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;
    const query = searchQuery.toLowerCase();
    return apps.filter(app => app.title.toLowerCase().includes(query));
  }, [apps, searchQuery]);

  useEffect(() => {
    fetchApps();

    const channel = supabase
      .channel('apps-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apps' }, () => {
        fetchApps();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canManage = useMemo(() => !!session && isOwner, [session, isOwner]);

  const fetchApps = async () => {
    const { data, error } = await supabase.from('apps').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch apps:', error);
    } else {
      setApps((data as App[]) || []);
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

  const openEdit = (app: App) => {
    setEditingApp(app);
    setEditTitle(app.title);
    setEditSourceCode(app.source_code);
    setEditHtmlFile(null);
    setEditImageFile(null);
    setEditImagePreview(app.image_url || null);
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

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManage) {
      toast.error('Only owners can add apps.');
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

      const response = await supabase.functions.invoke('manage-apps', {
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

      toast.success('App added successfully!');
      resetAddForm();
      setAddDialogOpen(false);
      fetchApps();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add app');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleUpdateApp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManage) {
      toast.error('Only owners can edit apps.');
      return;
    }

    if (!editingApp) return;

    if (!editTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }

    setSubmittingEdit(true);

    try {
      const imageBase64 = editImageFile ? await fileToDataUrl(editImageFile) : null;
      const htmlBase64 = editHtmlFile ? await fileToDataUrl(editHtmlFile) : null;

      const response = await supabase.functions.invoke('manage-apps', {
        body: {
          action: 'update',
          device_id: getDeviceId(),
          app_id: editingApp.id,
          title: editTitle.trim(),
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

      toast.success('App updated');
      setEditDialogOpen(false);
      setEditingApp(null);
      fetchApps();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update app');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (!canManage) {
      toast.error('Only owners can delete apps.');
      return;
    }

    if (!confirm('Are you sure you want to delete this app?')) return;

    try {
      const response = await supabase.functions.invoke('manage-apps', {
        body: {
          action: 'delete',
          device_id: getDeviceId(),
          app_id: appId,
        },
      });

      if (response.error) {
        throw new Error(await getInvokeErrorMessage(response.error));
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success('App deleted');
      fetchApps();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete app');
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please log in to view apps.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <AppWindow className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Apps</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps..."
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
                Add App
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New App</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddApp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">App Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter app title"
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
                  <Label>App Image (Optional)</Label>
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="App image preview"
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
                  {submittingAdd ? 'Adding…' : 'Add App'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading apps…</p>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <AppWindow className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{searchQuery ? 'No apps match your search.' : 'No apps available yet.'}</p>
          {canManage && <p className="text-sm text-muted-foreground mt-1">Click "Add App" to get started!</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredApps.map((app) => (
              <Card
                key={app.id}
                className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
                onClick={() => setSelectedApp(app)}
              >
                <div className="aspect-square w-full overflow-hidden">
                  {app.image_url ? (
                    <img src={app.image_url} alt={app.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <AppWindow className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <span className="truncate">{app.title}</span>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(app);
                          }}
                          aria-label="Edit app"
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
                            handleDeleteApp(app.id);
                          }}
                          aria-label="Delete app"
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

      {/* Edit App Dialog (owner only) */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingApp(null);
            setEditHtmlFile(null);
            setEditImageFile(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Edit App
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateApp} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">App Title</Label>
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
              <Label>App Image</Label>
              {editImagePreview ? (
                <div className="relative">
                  <img
                    src={editImagePreview}
                    alt="Current app image"
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
              <Button type="submit" className="flex-1" disabled={submittingEdit || !editingApp}>
                {submittingEdit ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!editingApp}
                onClick={() => editingApp && handleDeleteApp(editingApp.id)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* App Player Dialog */}
      <AppPlayerDialog app={selectedApp} onClose={() => setSelectedApp(null)} />
    </div>
  );
}

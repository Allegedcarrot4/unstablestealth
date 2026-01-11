import { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: string;
  message: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements'
        },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });

    if (data) {
      setAnnouncements(data as Announcement[]);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.id}
          className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 flex items-center gap-3 animate-fade-in"
        >
          <Megaphone className="h-5 w-5 text-primary shrink-0" />
          <p className="flex-1 text-sm text-foreground">{announcement.message}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => handleDismiss(announcement.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

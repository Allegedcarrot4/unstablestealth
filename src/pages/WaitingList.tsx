import { useState, useEffect } from 'react';
import { Clock, Check, X, Trash2, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface WaitingEntry {
  id: string;
  device_id: string;
  ip_address: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const WaitingList = () => {
  const [entries, setEntries] = useState<WaitingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const deviceId = localStorage.getItem('deviceId') || '';

  const fetchWaitingList = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('manage-waiting-list', {
        body: { action: 'list', device_id: deviceId }
      });

      if (response.error || response.data?.error) {
        toast({
          title: 'Error',
          description: response.data?.error || 'Failed to fetch waiting list',
          variant: 'destructive'
        });
        return;
      }

      setEntries(response.data.waiting_list || []);
    } catch (error) {
      console.error('Failed to fetch waiting list:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch waiting list',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitingList();
  }, []);

  const handleAction = async (waitingId: string, action: 'approve' | 'deny' | 'delete') => {
    setActionLoading(waitingId);
    try {
      const response = await supabase.functions.invoke('manage-waiting-list', {
        body: { action, device_id: deviceId, waiting_id: waitingId }
      });

      if (response.error || response.data?.error) {
        toast({
          title: 'Error',
          description: response.data?.error || `Failed to ${action} request`,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success',
        description: `Request ${action === 'delete' ? 'deleted' : action + 'd'} successfully`
      });

      fetchWaitingList();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${action} request`,
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/50">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">Approved</Badge>;
      case 'denied':
        return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/50">Denied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = entries.filter(e => e.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 neon-glow border border-primary/30">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono text-primary text-glow">Waiting List</h1>
            <p className="text-sm text-muted-foreground">
              {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={fetchWaitingList}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-primary font-mono">Loading...</div>
        </div>
      ) : entries.length === 0 ? (
        <Card className="glass border-border">
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No waiting list entries</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="glass border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <span className="text-muted-foreground">Device:</span>
                    <span className="text-foreground">{entry.device_id.slice(0, 8)}...</span>
                    {getStatusBadge(entry.status)}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {entry.ip_address && (
                      <span>IP: {entry.ip_address}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500/50 hover:bg-green-500/20"
                          onClick={() => handleAction(entry.id, 'approve')}
                          disabled={actionLoading === entry.id}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/50 hover:bg-destructive/20"
                          onClick={() => handleAction(entry.id, 'deny')}
                          disabled={actionLoading === entry.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleAction(entry.id, 'delete')}
                      disabled={actionLoading === entry.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WaitingList;

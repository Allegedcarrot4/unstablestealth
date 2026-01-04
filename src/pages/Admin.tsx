import { useState, useEffect } from 'react';
import { Shield, Ban, Trash2, RefreshCw, Users, MessageCircle, Power, UserCog, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SessionData {
  id: string;
  device_id: string;
  role: string;
  is_banned: boolean;
  created_at: string;
  last_active_at: string;
}

interface BannedDevice {
  id: string;
  device_id: string;
  banned_at: string;
  reason: string | null;
}

interface ChatMessage {
  id: string;
  session_id: string;
  message: string;
  created_at: string;
}

interface Profile {
  session_id: string;
  username: string;
}

const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

export const Admin = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [bannedDevices, setBannedDevices] = useState<BannedDevice[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [siteEnabled, setSiteEnabled] = useState(true);
  const [isTogglingsite, setIsTogglingSite] = useState(false);
  const { session: currentSession, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    
    try {
      const device_id = getDeviceId();
      
      // Fetch admin data through secure edge function
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { device_id }
      });

      if (error) {
        console.error('Admin data fetch error:', error);
        toast({
          title: "Error fetching data",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data?.error) {
        console.error('Admin data error:', data.error);
        toast({
          title: "Access denied",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      setSessions(data.sessions || []);
      setBannedDevices(data.bannedDevices || []);
      setChatMessages(data.chatMessages || []);
      
      // Build profile map
      const profileMap: Record<string, string> = {};
      (data.profiles || []).forEach((p: Profile) => {
        profileMap[p.session_id] = p.username;
      });
      setProfiles(profileMap);

      // Fetch site settings
      const { data: siteData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'site_enabled')
        .single();
      
      if (siteData?.value && typeof siteData.value === 'object' && !Array.isArray(siteData.value)) {
        const value = siteData.value as { enabled?: boolean };
        setSiteEnabled(value.enabled ?? true);
      }
      
    } catch (err) {
      console.error('Fetch error:', err);
      toast({
        title: "Error",
        description: "Failed to fetch admin data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const banDevice = async (targetDeviceId: string) => {
    if (targetDeviceId === currentSession?.device_id) {
      toast({
        title: "Cannot ban yourself",
        variant: "destructive"
      });
      return;
    }

    try {
      const device_id = getDeviceId();
      
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { 
          action: 'ban_device',
          device_id,
          target_device_id: targetDeviceId
        }
      });

      if (error) {
        toast({
          title: "Failed to ban device",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Failed to ban device",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Device banned",
        description: `Device ${targetDeviceId.slice(0, 8)}... has been banned.`
      });

      fetchData();
    } catch (err) {
      console.error('Ban error:', err);
      toast({
        title: "Error",
        description: "Failed to ban device",
        variant: "destructive"
      });
    }
  };

  const unbanDevice = async (targetDeviceId: string) => {
    try {
      const device_id = getDeviceId();
      
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { 
          action: 'unban_device',
          device_id,
          target_device_id: targetDeviceId
        }
      });

      if (error) {
        toast({
          title: "Failed to unban device",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Failed to unban device",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Device unbanned",
        description: `Device ${targetDeviceId.slice(0, 8)}... has been unbanned.`
      });

      fetchData();
    } catch (err) {
      console.error('Unban error:', err);
      toast({
        title: "Error",
        description: "Failed to unban device",
        variant: "destructive"
      });
    }
  };

  const deleteSession = async (sessionId: string, targetDeviceId: string) => {
    if (targetDeviceId === currentSession?.device_id) {
      toast({
        title: "Cannot delete your own session",
        variant: "destructive"
      });
      return;
    }

    try {
      const device_id = getDeviceId();
      
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { 
          action: 'delete_session',
          device_id,
          target_session_id: sessionId,
          target_device_id: targetDeviceId
        }
      });

      if (error) {
        toast({
          title: "Failed to delete session",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Failed to delete session",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Session deleted"
      });

      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUsername = (sessionId: string) => {
    return profiles[sessionId] || 'Unknown';
  };

  const toggleSite = async () => {
    if (!isOwner) return;
    
    setIsTogglingSite(true);
    try {
      const device_id = getDeviceId();
      const newEnabled = !siteEnabled;
      
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { 
          action: 'toggle_site',
          device_id,
          enabled: newEnabled
        }
      });

      if (error || data?.error) {
        toast({
          title: "Failed to toggle site",
          description: data?.error || error?.message,
          variant: "destructive"
        });
        return;
      }

      setSiteEnabled(newEnabled);
      toast({
        title: newEnabled ? "Site Enabled" : "Site Disabled",
        description: newEnabled 
          ? "All users can now access the site." 
          : "Only owners can access the site now."
      });
    } catch (err) {
      console.error('Toggle site error:', err);
      toast({
        title: "Error",
        description: "Failed to toggle site status",
        variant: "destructive"
      });
    } finally {
      setIsTogglingSite(false);
    }
  };

  const changeUserRole = async (targetDeviceId: string, newRole: string) => {
    if (!isOwner) return;

    try {
      const device_id = getDeviceId();
      
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { 
          action: 'change_role',
          device_id,
          target_device_id: targetDeviceId,
          new_role: newRole
        }
      });

      if (error || data?.error) {
        toast({
          title: "Failed to change role",
          description: data?.error || error?.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Role Changed",
        description: `User role changed to ${newRole}`
      });

      fetchData();
    } catch (err) {
      console.error('Change role error:', err);
      toast({
        title: "Error",
        description: "Failed to change user role",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10 neon-glow">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Manage users and devices</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Owner Controls */}
      {isOwner && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-500" />
            <h2 className="font-mono font-bold text-purple-500">Owner Controls</h2>
          </div>
          
          <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Power className={cn("h-5 w-5", siteEnabled ? "text-green-500" : "text-destructive")} />
                <div>
                  <p className="font-medium">Site Status</p>
                  <p className="text-sm text-muted-foreground">
                    {siteEnabled ? "Site is accessible to all users" : "Site is disabled for non-owners"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-sm font-mono",
                  siteEnabled ? "text-green-500" : "text-destructive"
                )}>
                  {siteEnabled ? "ENABLED" : "DISABLED"}
                </span>
                <Switch
                  checked={siteEnabled}
                  onCheckedChange={toggleSite}
                  disabled={isTogglingsite}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Active Sessions */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-mono font-bold">Active Sessions ({sessions.length})</h2>
        </div>
        
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Username</th>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Device ID</th>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Last Active</th>
                <th className="px-4 py-3 text-right text-xs font-mono text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((sess) => (
                <tr 
                  key={sess.id} 
                  className={cn(
                    "hover:bg-secondary/50 transition-colors",
                    sess.device_id === currentSession?.device_id && "bg-primary/5"
                  )}
                >
                  <td className="px-4 py-3 font-medium">
                    {getUsername(sess.id)}
                    {sess.device_id === currentSession?.device_id && (
                      <span className="ml-2 text-xs text-primary">(You)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                    {sess.device_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    {isOwner && sess.device_id !== currentSession?.device_id && sess.role !== 'owner' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className={cn(
                              "px-2 py-1 h-auto rounded-full text-xs font-mono gap-1",
                              sess.role === 'owner' 
                                ? "bg-purple-500/20 text-purple-500"
                                : sess.role === 'admin' 
                                  ? "bg-primary/20 text-primary" 
                                  : "bg-secondary text-muted-foreground"
                            )}
                          >
                            <UserCog className="h-3 w-3" />
                            {sess.role}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem 
                            onClick={() => changeUserRole(sess.device_id, 'user')}
                            className={sess.role === 'user' ? "bg-primary/10" : ""}
                          >
                            User
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => changeUserRole(sess.device_id, 'admin')}
                            className={sess.role === 'admin' ? "bg-primary/10" : ""}
                          >
                            Admin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-mono",
                        sess.role === 'owner' 
                          ? "bg-purple-500/20 text-purple-500"
                          : sess.role === 'admin' 
                            ? "bg-primary/20 text-primary" 
                            : "bg-secondary text-muted-foreground"
                      )}>
                        {sess.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-mono",
                      sess.is_banned ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-500"
                    )}>
                      {sess.is_banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(sess.last_active_at)}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {sess.device_id !== currentSession?.device_id && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => banDevice(sess.device_id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSession(sess.id, sess.device_id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No active sessions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Banned Devices */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-destructive" />
          <h2 className="font-mono font-bold">Banned Devices ({bannedDevices.length})</h2>
        </div>
        
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Device ID</th>
                <th className="px-4 py-3 text-left text-xs font-mono text-muted-foreground">Banned At</th>
                <th className="px-4 py-3 text-right text-xs font-mono text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bannedDevices.map((device) => (
                <tr key={device.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{device.device_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(device.banned_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unbanDevice(device.device_id)}
                    >
                      Unban
                    </Button>
                  </td>
                </tr>
              ))}
              {bannedDevices.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No banned devices
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Chat Messages */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="font-mono font-bold">Chat Messages ({chatMessages.length})</h2>
        </div>
        
        <div className="border border-border rounded-lg overflow-hidden">
          <ScrollArea className="h-80">
            <div className="divide-y divide-border">
              {chatMessages.map((msg) => {
                const sessionData = sessions.find(s => s.id === msg.session_id);
                const username = getUsername(msg.session_id);
                return (
                  <div key={msg.id} className="px-4 py-3 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {username}
                        {sessionData?.role === 'admin' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-primary/20 rounded text-xs text-primary">Admin</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{msg.message}</p>
                  </div>
                );
              })}
              {chatMessages.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  No chat messages yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </section>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Shield, Ban, Trash2, RefreshCw, Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

export const Admin = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [bannedDevices, setBannedDevices] = useState<BannedDevice[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { session: currentSession } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    
    const [sessionsRes, bannedRes, messagesRes, profilesRes] = await Promise.all([
      supabase.from('sessions').select('*').order('last_active_at', { ascending: false }),
      supabase.from('banned_devices').select('*').order('banned_at', { ascending: false }),
      supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('session_id, username')
    ]);
    
    if (sessionsRes.data) {
      setSessions(sessionsRes.data);
    }
    if (bannedRes.data) {
      setBannedDevices(bannedRes.data);
    }
    if (messagesRes.data) {
      setChatMessages(messagesRes.data);
    }
    if (profilesRes.data) {
      const profileMap: Record<string, string> = {};
      profilesRes.data.forEach((p: Profile) => {
        profileMap[p.session_id] = p.username;
      });
      setProfiles(profileMap);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const banDevice = async (deviceId: string) => {
    if (deviceId === currentSession?.device_id) {
      toast({
        title: "Cannot ban yourself",
        variant: "destructive"
      });
      return;
    }

    const { error: banError } = await supabase
      .from('banned_devices')
      .insert({ 
        device_id: deviceId, 
        banned_by: currentSession?.id 
      });
    
    if (banError) {
      toast({
        title: "Failed to ban device",
        description: banError.message,
        variant: "destructive"
      });
      return;
    }

    // Update session to mark as banned
    await supabase
      .from('sessions')
      .update({ is_banned: true })
      .eq('device_id', deviceId);

    toast({
      title: "Device banned",
      description: `Device ${deviceId.slice(0, 8)}... has been banned.`
    });

    fetchData();
  };

  const unbanDevice = async (deviceId: string) => {
    await supabase
      .from('banned_devices')
      .delete()
      .eq('device_id', deviceId);

    await supabase
      .from('sessions')
      .update({ is_banned: false })
      .eq('device_id', deviceId);

    toast({
      title: "Device unbanned",
      description: `Device ${deviceId.slice(0, 8)}... has been unbanned.`
    });

    fetchData();
  };

  const deleteSession = async (sessionId: string, deviceId: string) => {
    if (deviceId === currentSession?.device_id) {
      toast({
        title: "Cannot delete your own session",
        variant: "destructive"
      });
      return;
    }

    await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    toast({
      title: "Session deleted"
    });

    fetchData();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUsername = (sessionId: string) => {
    return profiles[sessionId] || 'Unknown';
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
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-mono",
                      sess.role === 'admin' ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    )}>
                      {sess.role}
                    </span>
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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Session {
  id: string;
  device_id: string;
  role: 'user' | 'admin' | 'owner';
  is_banned: boolean;
  username?: string;
}

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isBanned: boolean;
  needsUsername: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string; needsUsername?: boolean }>;
  setUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkBanStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate a unique device ID
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  const checkBanStatus = useCallback(async (): Promise<boolean> => {
    const deviceId = getDeviceId();
    
    const { data: banData } = await supabase
      .from('banned_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    return !!banData;
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const deviceId = getDeviceId();
      
      // Check if banned first
      const isBanned = await checkBanStatus();
      if (isBanned) {
        setSession({ id: '', device_id: deviceId, role: 'user', is_banned: true });
        setIsLoading(false);
        return;
      }
      
      // Check for existing session
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();
      
      if (existingSession && !existingSession.is_banned) {
        // Check for profile/username
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('session_id', existingSession.id)
          .maybeSingle();
        
        setSession({
          id: existingSession.id,
          device_id: existingSession.device_id,
          role: existingSession.role as 'user' | 'admin' | 'owner',
          is_banned: existingSession.is_banned,
          username: profile?.username
        });
        
        if (!profile?.username) {
          setNeedsUsername(true);
        }
        
        // Update last active
        await supabase
          .from('sessions')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', existingSession.id);
      }
      
      setIsLoading(false);
    };
    
    checkSession();
  }, [checkBanStatus]);

  const login = async (password: string): Promise<{ success: boolean; error?: string; needsUsername?: boolean }> => {
    const deviceId = getDeviceId();
    
    try {
      // Call server-side authentication (passwords verified server-side)
      const response = await supabase.functions.invoke('authenticate', {
        body: { password, device_id: deviceId }
      });

      if (response.error) {
        console.error('Auth function error:', response.error);
        return { success: false, error: 'Authentication failed. Please try again.' };
      }

      const data = response.data;

      if (data.error) {
        return { success: false, error: data.error };
      }

      setSession({
        id: data.session.id,
        device_id: data.session.device_id,
        role: data.session.role as 'user' | 'admin' | 'owner',
        is_banned: data.session.is_banned,
        username: data.session.username
      });

      if (data.needsUsername) {
        setNeedsUsername(true);
        return { success: true, needsUsername: true };
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Authentication failed. Please try again.' };
    }
  };

  const setUsername = async (username: string): Promise<{ success: boolean; error?: string }> => {
    if (!session) {
      return { success: false, error: 'No active session' };
    }
    
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      return { success: false, error: 'Username must be 2-20 characters' };
    }
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('session_id', session.id)
      .maybeSingle();
    
    if (existingProfile) {
      // Update username
      const { error } = await supabase
        .from('profiles')
        .update({ username: trimmedUsername })
        .eq('session_id', session.id);
      
      if (error) {
        return { success: false, error: 'Failed to update username' };
      }
    } else {
      // Create profile
      const { error } = await supabase
        .from('profiles')
        .insert({ session_id: session.id, username: trimmedUsername });
      
      if (error) {
        return { success: false, error: 'Failed to save username' };
      }
    }
    
    setSession(prev => prev ? { ...prev, username: trimmedUsername } : null);
    setNeedsUsername(false);
    
    return { success: true };
  };

  const logout = async () => {
    const deviceId = getDeviceId();
    
    await supabase
      .from('sessions')
      .delete()
      .eq('device_id', deviceId);
    
    setSession(null);
    setNeedsUsername(false);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        session, 
        isLoading, 
        isLoggedIn: !!session && !session.is_banned && !!session.username,
        isAdmin: session?.role === 'admin' || session?.role === 'owner',
        isOwner: session?.role === 'owner',
        isBanned: session?.is_banned ?? false,
        needsUsername,
        login,
        setUsername,
        logout,
        checkBanStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

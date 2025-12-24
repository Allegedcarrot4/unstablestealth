import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Session {
  id: string;
  device_id: string;
  role: 'user' | 'admin';
  is_banned: boolean;
}

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
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
        setSession({
          id: existingSession.id,
          device_id: existingSession.device_id,
          role: existingSession.role as 'user' | 'admin',
          is_banned: existingSession.is_banned
        });
        
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

  const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const deviceId = getDeviceId();
    
    // Check if banned
    const isBanned = await checkBanStatus();
    if (isBanned) {
      return { success: false, error: 'Your device has been banned.' };
    }
    
    // Check passwords
    const isAdmin = password === 'helloadmin5*';
    const isUser = password === 'MCGSUCKS123';
    
    if (!isAdmin && !isUser) {
      return { success: false, error: 'Invalid password.' };
    }
    
    const role = isAdmin ? 'admin' : 'user';
    
    // Check if session already exists
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (existingSession) {
      // Update existing session
      const { data, error } = await supabase
        .from('sessions')
        .update({ role, last_active_at: new Date().toISOString() })
        .eq('id', existingSession.id)
        .select()
        .single();
      
      if (error) {
        return { success: false, error: 'Failed to update session.' };
      }
      
      setSession({
        id: data.id,
        device_id: data.device_id,
        role: data.role as 'user' | 'admin',
        is_banned: data.is_banned
      });
    } else {
      // Create new session
      const { data, error } = await supabase
        .from('sessions')
        .insert({ device_id: deviceId, role })
        .select()
        .single();
      
      if (error) {
        return { success: false, error: 'Failed to create session.' };
      }
      
      setSession({
        id: data.id,
        device_id: data.device_id,
        role: data.role as 'user' | 'admin',
        is_banned: data.is_banned
      });
    }
    
    return { success: true };
  };

  const logout = async () => {
    const deviceId = getDeviceId();
    
    await supabase
      .from('sessions')
      .delete()
      .eq('device_id', deviceId);
    
    setSession(null);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        session, 
        isLoading, 
        isLoggedIn: !!session && !session.is_banned,
        isAdmin: session?.role === 'admin',
        isBanned: session?.is_banned ?? false,
        login, 
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

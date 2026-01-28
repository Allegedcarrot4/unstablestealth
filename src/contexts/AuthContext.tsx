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
  siteDisabled: boolean;
  isWaiting: boolean;
  waitingMessage: string;
  login: (password: string) => Promise<{ success: boolean; error?: string; needsUsername?: boolean; waiting?: boolean }>;
  setUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkBanStatus: () => Promise<boolean>;
  checkSiteStatus: () => Promise<boolean>;
  checkWaitingStatus: () => Promise<{ waiting: boolean; message?: string }>;
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
  const [siteDisabled, setSiteDisabled] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState('');

  const checkBanStatus = useCallback(async (): Promise<boolean> => {
    const deviceId = getDeviceId();
    
    const { data: banData } = await supabase
      .from('banned_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    return !!banData;
  }, []);

  const checkSiteStatus = useCallback(async (): Promise<boolean> => {
    const { data: siteData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'site_enabled')
      .single();
    
    if (siteData?.value && typeof siteData.value === 'object' && !Array.isArray(siteData.value)) {
      const value = siteData.value as { enabled?: boolean };
      return !(value.enabled ?? true);
    }
    return false;
  }, []);

  const checkWaitingStatus = useCallback(async (): Promise<{ waiting: boolean; message?: string }> => {
    const deviceId = getDeviceId();
    
    const { data: waitingData } = await supabase
      .from('waiting_list')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    
    if (waitingData) {
      if (waitingData.status === 'pending') {
        return { waiting: true, message: 'Your access request is pending approval' };
      }
      if (waitingData.status === 'denied') {
        return { waiting: true, message: 'Your access request was denied' };
      }
    }
    
    return { waiting: false };
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const deviceId = getDeviceId();
      
      // Check if banned first (banned_devices is publicly readable)
      const isBanned = await checkBanStatus();
      if (isBanned) {
        setSession({ id: '', device_id: deviceId, role: 'user', is_banned: true });
        setIsLoading(false);
        return;
      }

      // Check waiting list status
      const waitingStatus = await checkWaitingStatus();
      if (waitingStatus.waiting) {
        setIsWaiting(true);
        setWaitingMessage(waitingStatus.message || '');
        setIsLoading(false);
        return;
      }
      
      // Try to restore session from localStorage (stored after successful login)
      const storedSession = localStorage.getItem('session_data');
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          // Validate the stored session belongs to this device
          if (parsed.device_id === deviceId) {
            setSession({
              id: parsed.id,
              device_id: parsed.device_id,
              role: parsed.role as 'user' | 'admin' | 'owner',
              is_banned: false,
              username: parsed.username
            });
            
            if (!parsed.username) {
              setNeedsUsername(true);
            }
            
            // Check site status for non-owners
            if (parsed.role !== 'owner') {
              const isDisabled = await checkSiteStatus();
              setSiteDisabled(isDisabled);
            }
          }
        } catch {
          // Invalid stored session, clear it
          localStorage.removeItem('session_data');
        }
      }
      
      setIsLoading(false);
    };
    
    checkSession();
  }, [checkBanStatus, checkSiteStatus, checkWaitingStatus]);

  const login = async (password: string): Promise<{ success: boolean; error?: string; needsUsername?: boolean; waiting?: boolean }> => {
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

      // Check if user is in waiting list
      if (data.waiting) {
        setIsWaiting(true);
        setWaitingMessage(data.message || 'Your access request is pending approval');
        return { success: true, waiting: true };
      }

      const sessionData = {
        id: data.session.id,
        device_id: data.session.device_id,
        role: data.session.role as 'user' | 'admin' | 'owner',
        is_banned: data.session.is_banned,
        username: data.session.username
      };
      
      setSession(sessionData);
      setIsWaiting(false);
      setWaitingMessage('');
      
      // SECURITY: Store session data locally since sessions table is blocked from client reads
      localStorage.setItem('session_data', JSON.stringify(sessionData));

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
    
    const deviceId = getDeviceId();
    
    try {
      // Use edge function for server-side validation and ownership check
      const response = await supabase.functions.invoke('update-profile', {
        body: { username, device_id: deviceId }
      });

      if (response.error) {
        return { success: false, error: 'Failed to update username. Please try again.' };
      }

      const data = response.data;

      if (data.error) {
        return { success: false, error: data.error };
      }

      const updatedSession = session ? { ...session, username: data.username } : null;
      setSession(updatedSession);
      setNeedsUsername(false);
      
      // Update stored session data
      if (updatedSession) {
        localStorage.setItem('session_data', JSON.stringify(updatedSession));
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update username. Please try again.' };
    }
  };

  const logout = async () => {
    // Clear local session data
    localStorage.removeItem('session_data');
    
    setSession(null);
    setNeedsUsername(false);
    setIsWaiting(false);
    setWaitingMessage('');
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
        siteDisabled,
        isWaiting,
        waitingMessage,
        login,
        setUsername,
        logout,
        checkBanStatus,
        checkSiteStatus,
        checkWaitingStatus
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

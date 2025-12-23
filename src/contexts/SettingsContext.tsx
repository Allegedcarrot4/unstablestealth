import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Settings {
  theme: 'cyan' | 'purple' | 'green' | 'red' | 'orange';
  timeFormat: '12h' | '24h';
  panicUrl: string;
  sidebarPosition: 'left' | 'right';
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  triggerPanic: () => void;
}

const defaultSettings: Settings = {
  theme: 'cyan',
  timeFormat: '12h',
  panicUrl: 'https://google.com',
  sidebarPosition: 'left',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('stealthSettings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('stealthSettings', JSON.stringify(settings));
    
    // Apply theme class
    document.documentElement.classList.remove('theme-purple', 'theme-green', 'theme-red', 'theme-orange');
    if (settings.theme !== 'cyan') {
      document.documentElement.classList.add(`theme-${settings.theme}`);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const triggerPanic = useCallback(() => {
    window.location.href = settings.panicUrl;
  }, [settings.panicUrl]);

  // Panic button keyboard shortcut (Ctrl+Q)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        triggerPanic();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerPanic]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, triggerPanic }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

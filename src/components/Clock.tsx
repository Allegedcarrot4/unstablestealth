import { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export const Clock = () => {
  const { settings } = useSettings();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    if (settings.timeFormat === '24h') {
      return time.toLocaleTimeString('en-US', { hour12: false });
    }
    return time.toLocaleTimeString('en-US', { hour12: true });
  };

  return (
    <div className="font-mono text-sm text-muted-foreground">
      {formatTime()}
    </div>
  );
};

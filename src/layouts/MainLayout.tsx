import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

export const MainLayout = () => {
  const { settings } = useSettings();

  return (
    <div className="min-h-screen gradient-dark">
      <Sidebar />
      <main 
        className={cn(
          "min-h-screen transition-all duration-300",
          settings.sidebarPosition === 'left' ? "ml-16 lg:ml-56" : "mr-16 lg:mr-56"
        )}
      >
        <Outlet />
      </main>
      {/* Scanline overlay for retro effect */}
      <div className="fixed inset-0 pointer-events-none scanline opacity-30" />
    </div>
  );
};

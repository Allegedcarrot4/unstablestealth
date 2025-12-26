import { Link, useLocation } from 'react-router-dom';
import { 
  Globe, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  Crown,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Clock } from './Clock';
import { Button } from './ui/button';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: Globe, label: 'Embedder' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
  { path: '/ai', icon: Sparkles, label: 'AI' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export const Sidebar = () => {
  const location = useLocation();
  const { settings, triggerPanic } = useSettings();
  const { isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const allNavItems = isAdmin 
    ? [...navItems.slice(0, 2), { path: '/admin', icon: Crown, label: 'Admin' }, ...navItems.slice(2)]
    : navItems;

  return (
    <aside 
      className={cn(
        "fixed top-0 h-full z-50 flex flex-col glass border-r border-border transition-all duration-300",
        settings.sidebarPosition === 'left' ? 'left-0' : 'right-0 border-l border-r-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h1 className="font-mono font-bold text-primary text-glow text-sm">
              UNSTABLE STEALTH
            </h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 hover:bg-secondary"
          >
            {collapsed ? (
              settings.sidebarPosition === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
            ) : (
              settings.sidebarPosition === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2">
        {allNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === '/' && location.pathname === '/embedder');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                "hover:bg-secondary group",
                isActive && "bg-primary/10 neon-glow border border-primary/30"
              )}
            >
              <item.icon 
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} 
              />
              {!collapsed && (
                <span className={cn(
                  "font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Panic Button */}
        <Button
          onClick={triggerPanic}
          variant="destructive"
          className={cn(
            "w-full gap-2 font-mono text-xs",
            collapsed && "px-0"
          )}
        >
          <Zap className="h-4 w-4" />
          {!collapsed && <span>PANIC (Ctrl+Q)</span>}
        </Button>
        
        {!collapsed && <Clock />}
      </div>
    </aside>
  );
};

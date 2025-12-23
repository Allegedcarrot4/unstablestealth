import { Settings as SettingsIcon, Palette, Clock, AlertTriangle, PanelLeft } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const themes = [
  { id: 'cyan', name: 'Cyan', color: 'bg-[hsl(175,80%,50%)]' },
  { id: 'purple', name: 'Purple', color: 'bg-[hsl(280,70%,60%)]' },
  { id: 'green', name: 'Green', color: 'bg-[hsl(142,70%,50%)]' },
  { id: 'red', name: 'Red', color: 'bg-[hsl(0,70%,55%)]' },
  { id: 'orange', name: 'Orange', color: 'bg-[hsl(25,90%,55%)]' },
] as const;

export const Settings = () => {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10 neon-glow">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono">Settings</h1>
          <p className="text-muted-foreground text-sm">Customize your experience</p>
        </div>
      </div>

      {/* Theme Selection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="font-mono font-bold">Theme</h2>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => updateSettings({ theme: theme.id })}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                settings.theme === theme.id 
                  ? "border-primary neon-glow bg-primary/10" 
                  : "border-border hover:border-primary/50 bg-card"
              )}
            >
              <div className={cn("w-8 h-8 rounded-full", theme.color)} />
              <span className="text-xs font-medium">{theme.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Time Format */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-mono font-bold">Time Format</h2>
        </div>
        <div className="flex gap-3">
          <Button
            variant={settings.timeFormat === '12h' ? 'default' : 'outline'}
            onClick={() => updateSettings({ timeFormat: '12h' })}
            className="flex-1"
          >
            12-Hour (AM/PM)
          </Button>
          <Button
            variant={settings.timeFormat === '24h' ? 'default' : 'outline'}
            onClick={() => updateSettings({ timeFormat: '24h' })}
            className="flex-1"
          >
            24-Hour
          </Button>
        </div>
      </section>

      {/* Sidebar Position */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <PanelLeft className="h-5 w-5 text-primary" />
          <h2 className="font-mono font-bold">Sidebar Position</h2>
        </div>
        <div className="flex gap-3">
          <Button
            variant={settings.sidebarPosition === 'left' ? 'default' : 'outline'}
            onClick={() => updateSettings({ sidebarPosition: 'left' })}
            className="flex-1"
          >
            Left
          </Button>
          <Button
            variant={settings.sidebarPosition === 'right' ? 'default' : 'outline'}
            onClick={() => updateSettings({ sidebarPosition: 'right' })}
            className="flex-1"
          >
            Right
          </Button>
        </div>
      </section>

      {/* Panic Button Settings */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="font-mono font-bold">Panic Button</h2>
        </div>
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-2 py-1 rounded bg-secondary font-mono text-xs">Ctrl + Q</kbd> to instantly redirect to your chosen safe website.
          </p>
          <div className="space-y-2">
            <Label htmlFor="panic-url">Redirect URL</Label>
            <Input
              id="panic-url"
              value={settings.panicUrl}
              onChange={(e) => updateSettings({ panicUrl: e.target.value })}
              placeholder="https://google.com"
              className="font-mono"
            />
          </div>
          <Button
            variant="destructive"
            onClick={() => window.location.href = settings.panicUrl}
            className="w-full"
          >
            Test Panic Button
          </Button>
        </div>
      </section>
    </div>
  );
};

import { 
  Trash2, 
  ExternalLink, 
  Maximize, 
  RefreshCw,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface EmbedControlsProps {
  onClear: () => void;
  onNewTab: () => void;
  onFullscreen: () => void;
  onReload: () => void;
  onBack: () => void;
  onForward: () => void;
  hasUrl: boolean;
}

export const EmbedControls = ({
  onClear,
  onNewTab,
  onFullscreen,
  onReload,
  onBack,
  onForward,
  hasUrl,
}: EmbedControlsProps) => {
  const controls = [
    { icon: ArrowLeft, label: 'Back', action: onBack, disabled: !hasUrl },
    { icon: ArrowRight, label: 'Forward', action: onForward, disabled: !hasUrl },
    { icon: RefreshCw, label: 'Reload', action: onReload, disabled: !hasUrl },
    { icon: Maximize, label: 'Fullscreen', action: onFullscreen, disabled: !hasUrl },
    { icon: ExternalLink, label: 'New Tab', action: onNewTab, disabled: !hasUrl },
    { icon: Trash2, label: 'Clear', action: onClear, disabled: !hasUrl },
  ];

  return (
    <div className="flex items-center gap-1 p-2 glass rounded-lg border border-border">
      {controls.map((control) => (
        <Tooltip key={control.label}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={control.action}
              disabled={control.disabled}
              className="h-9 w-9 hover:bg-secondary hover:text-primary disabled:opacity-30"
            >
              <control.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{control.label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

import { Keyboard, Move, Copy, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ShortcutItem {
  keys: string[];
  description: string;
  icon: React.ReactNode;
}

const shortcuts: ShortcutItem[] = [
  {
    keys: ['Glisser-déposer'],
    description: 'Déplacer une affectation vers une autre case',
    icon: <Move className="h-4 w-4" />,
  },
  {
    keys: ['Bouton', 'Mode copie'],
    description: 'Activer le mode copie pour dupliquer au lieu de déplacer',
    icon: <Copy className="h-4 w-4" />,
  },
  {
    keys: ['Ctrl', '+', 'Z'],
    description: 'Annuler le dernier déplacement',
    icon: <Undo2 className="h-4 w-4" />,
  },
];

export const KeyboardShortcutsHelp = () => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-80 p-4">
          <p className="font-semibold mb-3 text-sm flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Raccourcis et Actions
          </p>
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-start gap-3"
              >
                <div className="flex-shrink-0 text-muted-foreground mt-0.5">
                  {shortcut.icon}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex}>
                        {key === '+' ? (
                          <span className="text-muted-foreground mx-0.5">+</span>
                        ) : (
                          <kbd className="px-1.5 py-0.5 text-xs font-medium bg-muted border border-border rounded">
                            {key}
                          </kbd>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shortcut.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center pt-3 mt-3 border-t">
            Clic droit sur une affectation ou note pour plus d'options
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

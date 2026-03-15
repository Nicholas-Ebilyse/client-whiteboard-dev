import { cn } from '@/lib/utils';

interface TechnicianHeaderProps {
  name: string;
  isArchived?: boolean;
  backgroundColor?: string;
}

// Helper to determine if a color is light (needs dark text) or dark (needs light text)
const isLightColor = (color: string): boolean => {
  // Handle CSS variable references - check if we're in dark mode
  if (color.includes('var(--')) {
    // In dark mode, muted backgrounds are dark, in light mode they're light
    const isDarkMode = document.documentElement.classList.contains('dark');
    return !isDarkMode;
  }
  
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  
  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }
  
  // Handle hsl without variables
  if (color.startsWith('hsl') && !color.includes('var(')) {
    const matches = color.match(/[\d.]+/g);
    if (matches && matches.length >= 3) {
      const l = parseFloat(matches[2]);
      return l > 50;
    }
  }
  
  // Default: check dark mode
  const isDarkMode = document.documentElement.classList.contains('dark');
  return !isDarkMode;
};

export const TechnicianHeader = ({ name, isArchived, backgroundColor }: TechnicianHeaderProps) => {
  const needsDarkText = backgroundColor ? isLightColor(backgroundColor) : false;
  
  return (
    <div className="flex items-center justify-center w-full px-2">
      <span className={cn(
        "font-semibold text-[clamp(0.875rem,1.5vw,1.5rem)] leading-tight truncate text-center",
        isArchived && "opacity-60 italic",
        needsDarkText ? "text-gray-800" : "text-gray-100"
      )}>
        {name}
        {isArchived && <span className="text-xs ml-1">(Archivé)</span>}
      </span>
    </div>
  );
};

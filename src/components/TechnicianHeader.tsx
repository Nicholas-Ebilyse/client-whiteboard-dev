import { cn } from '@/lib/utils';

interface TechnicianHeaderProps {
  name: string;
  isArchived?: boolean;
  backgroundColor?: string;
}

export const TechnicianHeader = ({ name, isArchived }: TechnicianHeaderProps) => {
  return (
    <div className="flex items-center justify-center w-full px-2">
      <span className={cn(
        "font-semibold text-[clamp(0.875rem,1.5vw,1.5rem)] leading-tight truncate text-center text-slate-900",
        isArchived && "opacity-60 italic"
      )}>
        {name}
        {isArchived && <span className="text-xs ml-1">(Archivé)</span>}
      </span>
    </div>
  );
};

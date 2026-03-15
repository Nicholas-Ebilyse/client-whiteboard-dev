import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useState } from 'react';
import { getWeek, getYear } from 'date-fns';
import { WeekNavigationDialog } from './WeekNavigationDialog';

interface WeekSelectorProps {
  weekNumber: number;
  year: number;
  onWeekChange: (week: number, year: number) => void;
  onDragOver?: (e: React.DragEvent, direction: 'prev' | 'next') => void;
  onDrop?: (e: React.DragEvent, direction: 'prev' | 'next') => void;
  isDragging?: boolean;
}

export const WeekSelector = ({ 
  weekNumber, 
  year, 
  onWeekChange,
  onDragOver,
  onDrop,
  isDragging,
}: WeekSelectorProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handlePrevWeek = () => {
    if (weekNumber === 1) {
      onWeekChange(52, year - 1);
    } else {
      onWeekChange(weekNumber - 1, year);
    }
  };

  const handleNextWeek = () => {
    if (weekNumber === 52) {
      onWeekChange(1, year + 1);
    } else {
      onWeekChange(weekNumber + 1, year);
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleDragOver = (e: React.DragEvent, direction: 'prev' | 'next') => {
    e.preventDefault();
    onDragOver?.(e, direction);
  };

  const handleDrop = (e: React.DragEvent, direction: 'prev' | 'next') => {
    e.preventDefault();
    onDrop?.(e, direction);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={`h-8 w-8 ${isDragging ? 'ring-2 ring-dashed ring-primary/50 bg-primary/10' : ''}`}
              onClick={handlePrevWeek}
              onDragOver={(e) => handleDragOver(e, 'prev')}
              onDrop={(e) => handleDrop(e, 'prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          {isDragging && (
            <TooltipContent>
              <p>Déposer pour déplacer à la semaine précédente</p>
            </TooltipContent>
          )}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleOpenDialog}
              variant="default"
              className="px-3 py-1 h-8 text-sm font-medium"
            >
              Semaine {weekNumber}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cliquer pour changer de semaine</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={`h-8 w-8 ${isDragging ? 'ring-2 ring-dashed ring-primary/50 bg-primary/10' : ''}`}
              onClick={handleNextWeek}
              onDragOver={(e) => handleDragOver(e, 'next')}
              onDrop={(e) => handleDrop(e, 'next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          {isDragging && (
            <TooltipContent>
              <p>Déposer pour déplacer à la semaine suivante</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      <WeekNavigationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentWeek={weekNumber}
        currentYear={year}
        onWeekChange={onWeekChange}
      />
    </TooltipProvider>
  );
};

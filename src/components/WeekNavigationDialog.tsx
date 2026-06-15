import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { CalendarClock } from 'lucide-react';
import { getWeek, getYear, setWeek as setWeekDate, startOfWeek } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';

interface WeekNavigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWeek: number;
  currentYear: number;
  onWeekChange: (week: number, year: number) => void;
}

export const WeekNavigationDialog = ({
  open,
  onOpenChange,
  currentWeek,
  currentYear,
  onWeekChange,
}: WeekNavigationDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (open) {
      const date = new Date(currentYear, 0, 4);
      const weekDate = setWeekDate(date, currentWeek, { weekStartsOn: 1 });
      setSelectedDate(startOfWeek(weekDate, { weekStartsOn: 1 }));
    }
  }, [open, currentWeek, currentYear]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const newWeek = getWeek(date, { weekStartsOn: 1 });
      const newYear = date.getMonth() === 11 && newWeek === 1 ? date.getFullYear() + 1 : date.getFullYear();
      
      onWeekChange(newWeek, newYear);
      onOpenChange(false);
    }
  };

  const handleToday = () => {
    const today = new Date();
    onWeekChange(getWeek(today, { weekStartsOn: 1 }), getYear(today));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-fit">
        <DialogHeader>
          <DialogTitle>Sélectionner une semaine</DialogTitle>
          {/* This completely resolves the missing DialogDescription console warning! */}
          <DialogDescription className="sr-only">
            Utilisez le calendrier pour sélectionner une semaine.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            locale={fr}
            showOutsideDays
            showWeekNumber /* 👈 This turns on the highlighted week column! */
            className="border rounded-md bg-background shadow-sm"
          />

          <Button variant="outline" onClick={handleToday} className="w-full">
            <CalendarClock className="h-4 w-4 mr-2" />
            Revenir à la semaine actuelle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
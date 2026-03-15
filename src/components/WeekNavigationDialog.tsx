import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { ChevronUp, ChevronDown, CalendarClock } from 'lucide-react';
import { getWeek, getYear, setWeek as setWeekDate, format, startOfWeek, startOfMonth } from 'date-fns';
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
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [week, setWeek] = useState(currentWeek);
  const [year, setYear] = useState(currentYear);

  // Issue #3: Initialize with current week when dialog opens
  useEffect(() => {
    if (open) {
      setWeek(currentWeek);
      setYear(currentYear);
      // Calculate month from the current week
      const date = new Date(currentYear, 0, 4);
      const weekDate = setWeekDate(date, currentWeek, { weekStartsOn: 1 });
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
      setMonth(weekStart.getMonth() + 1);
    }
  }, [open, currentWeek, currentYear]);

  const handleWeekUp = () => {
    // Issue #3: When week changes, update month and year accordingly
    if (week > 1) {
      const newWeek = week - 1;
      setWeek(newWeek);
      const date = new Date(year, 0, 4);
      const weekDate = setWeekDate(date, newWeek, { weekStartsOn: 1 });
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
      setMonth(weekStart.getMonth() + 1);
      setYear(weekStart.getFullYear());
    } else {
      const newYear = year - 1;
      const newWeek = 52;
      setWeek(newWeek);
      setYear(newYear);
      const date = new Date(newYear, 0, 4);
      const weekDate = setWeekDate(date, newWeek, { weekStartsOn: 1 });
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
      setMonth(weekStart.getMonth() + 1);
    }
  };

  const handleWeekDown = () => {
    // Issue #3: When week changes, update month and year accordingly
    if (week < 52) {
      const newWeek = week + 1;
      setWeek(newWeek);
      const date = new Date(year, 0, 4);
      const weekDate = setWeekDate(date, newWeek, { weekStartsOn: 1 });
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
      setMonth(weekStart.getMonth() + 1);
      setYear(weekStart.getFullYear());
    } else {
      const newYear = year + 1;
      const newWeek = 1;
      setWeek(newWeek);
      setYear(newYear);
      const date = new Date(newYear, 0, 4);
      const weekDate = setWeekDate(date, newWeek, { weekStartsOn: 1 });
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
      setMonth(weekStart.getMonth() + 1);
    }
  };

  const handleMonthUp = () => {
    // Issue #3: When month changes, update week and year
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear = year - 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    const firstDayOfMonth = new Date(newYear, newMonth - 1, 1);
    const firstWeekOfMonth = getWeek(firstDayOfMonth, { weekStartsOn: 1 });
    setWeek(firstWeekOfMonth);
  };

  const handleMonthDown = () => {
    // Issue #3: When month changes, update week and year
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear = year + 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    const firstDayOfMonth = new Date(newYear, newMonth - 1, 1);
    const firstWeekOfMonth = getWeek(firstDayOfMonth, { weekStartsOn: 1 });
    setWeek(firstWeekOfMonth);
  };

  const handleYearUp = () => {
    // Issue #3: When year changes, update month and week
    const newYear = year - 1;
    setYear(newYear);
    const firstDayOfMonth = new Date(newYear, month - 1, 1);
    const firstWeekOfMonth = getWeek(firstDayOfMonth, { weekStartsOn: 1 });
    setWeek(firstWeekOfMonth);
  };

  const handleYearDown = () => {
    // Issue #3: When year changes, update month and week
    const newYear = year + 1;
    setYear(newYear);
    const firstDayOfMonth = new Date(newYear, month - 1, 1);
    const firstWeekOfMonth = getWeek(firstDayOfMonth, { weekStartsOn: 1 });
    setWeek(firstWeekOfMonth);
  };

  const handleToday = () => {
    const today = new Date();
    const todayWeek = getWeek(today, { weekStartsOn: 1 });
    const todayYear = getYear(today);
    setWeek(todayWeek);
    setMonth(today.getMonth() + 1);
    setYear(todayYear);
    onWeekChange(todayWeek, todayYear);
    onOpenChange(false);
  };

  const handleApply = () => {
    onWeekChange(week, year);
    onOpenChange(false);
  };

  // **Issue #3 Fix**: Calculate week start date with full year
  const getWeekStartDate = () => {
    const date = new Date(year, 0, 4);
    const weekDate = setWeekDate(date, week, { weekStartsOn: 1 });
    const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
    return format(weekStart, 'd MMMM yyyy', { locale: fr });
  };

  // Issue #7: Format month names with lowercase for French grammar
  const monthNames = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sélectionner une semaine</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-6">
          {/* Issue #3: Week, Month, Year selector - Week left, Month center, Year right */}
          <div className="flex gap-6 items-start">
            {/* Week selector */}
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleWeekUp}
                className="h-8 w-8"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-xl font-semibold min-w-[50px] text-center">
                {week}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleWeekDown}
                className="h-8 w-8"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Month selector */}
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMonthUp}
                className="h-8 w-8"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-xl font-semibold min-w-[120px] text-center">
                {monthNames[month - 1]}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMonthDown}
                className="h-8 w-8"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Year selector */}
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleYearUp}
                className="h-8 w-8"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-xl font-semibold min-w-[70px] text-center">
                {year}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleYearDown}
                className="h-8 w-8"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week start date */}
          <div className="text-sm text-muted-foreground">
            {getWeekStartDate()}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleToday}
              className="flex-1"
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Aujourd'hui
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1"
            >
              Appliquer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

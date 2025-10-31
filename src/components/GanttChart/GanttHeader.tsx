import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface GanttHeaderProps {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
}

export const GanttHeader = ({ startDate, endDate, dayWidth }: GanttHeaderProps) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Group days by month for month headers
  const months = [] as { date: Date; width: number }[];
  let currentMonth = startOfMonth(startDate);
  const lastMonth = endOfMonth(endDate);
  
  while (currentMonth <= lastMonth) {
    const monthStart = currentMonth > startDate ? currentMonth : startDate;
    const monthEnd = endOfMonth(currentMonth) < endDate ? endOfMonth(currentMonth) : endDate;
    const daysInView = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
    
    months.push({
      date: currentMonth,
      width: daysInView * dayWidth,
    });
    
    currentMonth = addMonths(currentMonth, 1);
  }

  const totalWidth = days.length * dayWidth;

  return (
    <div className="border-b border-border bg-card">
      <div style={{ width: `${totalWidth}px` }}>
        {/* Month headers */}
        <div className="flex border-b border-border">
          {months.map((month, index) => (
            <div
              key={index}
              className="border-r border-border px-2 py-2 text-center text-sm font-medium"
              style={{ width: `${month.width}px` }}
            >
              {format(month.date, "MMMM yyyy")}
            </div>
          ))}
        </div>
        
        {/* Day headers */}
        <div className="flex">
          {days.map((day, index) => (
            <div
              key={index}
              className="border-r border-border px-1 py-2 text-center text-xs text-muted-foreground"
              style={{ width: `${dayWidth}px` }}
            >
              {format(day, "d")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

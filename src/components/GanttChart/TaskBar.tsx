import { Task } from "@/types/gantt";
import { differenceInDays } from "date-fns";

interface TaskBarProps {
  task: Task;
  chartStartDate: Date;
  dayWidth: number;
  rowHeight: number;
  onTaskClick: (task: Task) => void;
}

export const TaskBar = ({ task, chartStartDate, dayWidth, rowHeight, onTaskClick }: TaskBarProps) => {
  const startOffset = differenceInDays(task.startDate, chartStartDate);
  const duration = differenceInDays(task.endDate, task.startDate) + 1;
  
  const left = startOffset * dayWidth;
  const width = duration * dayWidth;

  const isSection = task.children && task.children.length > 0;

  return (
    <div
      className="absolute cursor-pointer group"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: "50%",
        transform: "translateY(-50%)",
        height: isSection ? "10px" : "28px",
        zIndex: 10,
      }}
      onClick={() => onTaskClick(task)}
    >
      <div className={`h-full rounded relative overflow-hidden transition-all ${
        isSection ? "bg-primary/80" : "bg-chart-1"
      }`}>
        {/* Progress indicator in green */}
        {task.progress > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-green-500/70 rounded-l transition-all"
            style={{ width: `${task.progress}%` }}
          />
        )}
        
        {/* Task title on bar */}
        {!isSection && (
          <div className="absolute inset-0 flex items-center px-2 text-xs font-medium text-primary-foreground truncate z-20">
            {task.title}
          </div>
        )}
        
        {/* Dark overlay on hover with 90% opacity */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/90 transition-all z-30 rounded" />
        
        {/* Progress percentage on hover - shown above dark overlay */}
        {!isSection && task.progress > 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-40">
            {task.progress}%
          </div>
        )}
      </div>
    </div>
  );
};

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

  return (
    <div
      className="absolute cursor-pointer group"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: "50%",
        transform: "translateY(-50%)",
        height: "28px",
      }}
      onClick={() => onTaskClick(task)}
    >
      <div className="h-full bg-primary rounded relative overflow-hidden transition-all group-hover:bg-primary/80">
        {/* Progress indicator */}
        <div
          className="absolute inset-y-0 left-0 bg-primary/60 rounded-l"
          style={{ width: `${task.progress}%` }}
        />
        
        {/* Task title on bar */}
        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium text-primary-foreground truncate">
          {task.title}
        </div>
      </div>
    </div>
  );
};

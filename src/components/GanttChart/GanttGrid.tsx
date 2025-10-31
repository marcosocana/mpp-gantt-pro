import { Task } from "@/types/gantt";
import { eachDayOfInterval } from "date-fns";
import { TaskBar } from "./TaskBar";

interface GanttGridProps {
  tasks: Task[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  rowHeight: number;
  onTaskClick: (task: Task) => void;
}

export const GanttGrid = ({
  tasks,
  startDate,
  endDate,
  dayWidth,
  rowHeight,
  onTaskClick,
}: GanttGridProps) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const flattenTasks = (tasks: Task[]): Task[] => {
    const result: Task[] = [];
    tasks.forEach(task => {
      result.push(task);
      if (task.children && task.isExpanded) {
        result.push(...flattenTasks(task.children));
      }
    });
    return result;
  };
  
  const flatTasks = flattenTasks(tasks);

  return (
    <div className="relative bg-card overflow-x-auto overflow-y-auto">
      {/* Vertical grid lines for days */}
      <div className="absolute inset-0 flex pointer-events-none">
        {days.map((_, index) => (
          <div
            key={index}
            className="border-r border-border"
            style={{ width: `${dayWidth}px` }}
          />
        ))}
      </div>

      {/* Task rows */}
      <div className="relative">
        {flatTasks.map((task, index) => (
          <div
            key={task.id}
            className="relative border-b border-border"
            style={{ height: `${rowHeight}px` }}
          >
            <TaskBar
              task={task}
              chartStartDate={startDate}
              dayWidth={dayWidth}
              rowHeight={rowHeight}
              onTaskClick={onTaskClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

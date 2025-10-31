import { Task } from "@/types/gantt";
import { eachDayOfInterval } from "date-fns";
import { TaskBar } from "./TaskBar";
import React from "react";

interface GanttGridProps {
  tasks: Task[];
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  rowHeight: number;
  onTaskClick: (task: Task) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
}

export const GanttGrid = ({
  tasks,
  startDate,
  endDate,
  dayWidth,
  rowHeight,
  onTaskClick,
  scrollRef,
}: GanttGridProps) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalWidth = days.length * dayWidth;
  
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
    <div ref={scrollRef} className="h-full overflow-auto bg-card">
      <div className="relative" style={{ width: `${totalWidth}px`, minHeight: '100%' }}>
        {/* Vertical grid lines for days - background layer */}
        <div className="absolute inset-0 flex pointer-events-none" style={{ zIndex: 1 }}>
          {days.map((_, index) => (
            <div
              key={index}
              className="border-r border-border/40"
              style={{ width: `${dayWidth}px` }}
            />
          ))}
        </div>

        {/* Task rows - foreground layer */}
        <div className="relative" style={{ zIndex: 5 }}>
          {flatTasks.map((task, index) => (
            <div
              key={task.id}
              className="relative border-b border-border/50"
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
    </div>
  );
};

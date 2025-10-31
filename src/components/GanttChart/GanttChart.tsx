import { useState } from "react";
import { Task } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { TaskList } from "./TaskList";
import { GanttGrid } from "./GanttGrid";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

interface GanttChartProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onUpdateTasks: (tasks: Task[]) => void;
}

export const GanttChart = ({ tasks, onTaskClick, onUpdateTasks }: GanttChartProps) => {
  const DAY_WIDTH = 40;
  const ROW_HEIGHT = 48;
  const TASK_LIST_WIDTH = 320;

  // Calculate date range from tasks
  const getDateRange = () => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        start: startOfMonth(today),
        end: endOfMonth(addMonths(today, 2)),
      };
    }

    const allDates = tasks.flatMap(task => [task.startDate, task.endDate]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    return {
      start: startOfMonth(minDate),
      end: endOfMonth(addMonths(maxDate, 1)),
    };
  };

  const { start: startDate, end: endDate } = getDateRange();

  const handleToggleExpand = (taskId: string) => {
    const toggleInTasks = (tasks: Task[]): Task[] => {
      return tasks.map(task => {
        if (task.id === taskId) {
          return { ...task, isExpanded: !task.isExpanded };
        }
        if (task.children) {
          return { ...task, children: toggleInTasks(task.children) };
        }
        return task;
      });
    };

    onUpdateTasks(toggleInTasks(tasks));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border">
        <div
          className="bg-card border-r border-border flex items-center px-4 py-2"
          style={{ width: `${TASK_LIST_WIDTH}px` }}
        >
          <h2 className="font-semibold text-sm">Título</h2>
        </div>
        <div className="flex-1 overflow-x-auto">
          <GanttHeader
            startDate={startDate}
            endDate={endDate}
            dayWidth={DAY_WIDTH}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: `${TASK_LIST_WIDTH}px` }}>
          <TaskList
            tasks={tasks}
            rowHeight={ROW_HEIGHT}
            onTaskClick={onTaskClick}
            onToggleExpand={handleToggleExpand}
          />
        </div>
        <div className="flex-1">
          <GanttGrid
            tasks={tasks}
            startDate={startDate}
            endDate={endDate}
            dayWidth={DAY_WIDTH}
            rowHeight={ROW_HEIGHT}
            onTaskClick={onTaskClick}
          />
        </div>
      </div>
    </div>
  );
};

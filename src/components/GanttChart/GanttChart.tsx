import { useEffect, useRef, useState } from "react";
import { Task } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { TaskList } from "./TaskList";
import { GanttGrid } from "./GanttGrid";
import { startOfMonth, endOfMonth } from "date-fns";

interface GanttChartProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onUpdateTasks: (tasks: Task[]) => void;
  startDate?: Date;
  endDate?: Date;
}

export const GanttChart = ({ tasks, onTaskClick, onUpdateTasks, startDate: propStartDate, endDate: propEndDate }: GanttChartProps) => {
  const DAY_WIDTH = 40;
  const ROW_HEIGHT = 48;
  const TASK_LIST_WIDTH = 320;

  const startDate = propStartDate || startOfMonth(new Date(2025, 10, 1));
  const endDate = propEndDate || endOfMonth(new Date(2025, 11, 31));

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headerEl = headerScrollRef.current;
    const gridEl = gridScrollRef.current;
    if (!headerEl || !gridEl) return;

    let syncing = false;

    const onHeaderScroll = () => {
      if (syncing) return;
      syncing = true;
      gridEl.scrollLeft = headerEl.scrollLeft;
      syncing = false;
    };

    const onGridScroll = () => {
      if (syncing) return;
      syncing = true;
      headerEl.scrollLeft = gridEl.scrollLeft;
      syncing = false;
    };

    headerEl.addEventListener("scroll", onHeaderScroll);
    gridEl.addEventListener("scroll", onGridScroll);

    return () => {
      headerEl.removeEventListener("scroll", onHeaderScroll);
      gridEl.removeEventListener("scroll", onGridScroll);
    };
  }, []);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-border shrink-0">
        <div
          className="bg-card border-r border-border flex items-center px-4 py-2 shrink-0"
          style={{ width: `${TASK_LIST_WIDTH}px` }}
        >
          <h2 className="font-semibold text-sm">Título</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="overflow-x-auto overflow-y-hidden" ref={headerScrollRef}>
            <GanttHeader
              startDate={startDate}
              endDate={endDate}
              dayWidth={DAY_WIDTH}
            />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="shrink-0 overflow-y-auto" style={{ width: `${TASK_LIST_WIDTH}px` }}>
          <TaskList
            tasks={tasks}
            rowHeight={ROW_HEIGHT}
            onTaskClick={onTaskClick}
            onToggleExpand={handleToggleExpand}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <GanttGrid
            tasks={tasks}
            startDate={startDate}
            endDate={endDate}
            dayWidth={DAY_WIDTH}
            rowHeight={ROW_HEIGHT}
            onTaskClick={onTaskClick}
            scrollRef={gridScrollRef}
          />
        </div>
      </div>
    </div>
  );
};

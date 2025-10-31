import { useEffect, useRef } from "react";
import { Task } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { DraggableTaskList } from "./DraggableTaskList";
import { GanttGrid } from "./GanttGrid";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

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

  // Calculate date range from tasks if not provided
  const calculateDateRange = () => {
    const flattenTasks = (tasks: Task[]): Task[] => {
      const result: Task[] = [];
      tasks.forEach(task => {
        result.push(task);
        if (task.children) {
          result.push(...flattenTasks(task.children));
        }
      });
      return result;
    };

    const allTasks = flattenTasks(tasks);
    
    if (allTasks.length === 0) {
      return {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
      };
    }

    const allDates = allTasks.flatMap(task => [task.startDate, task.endDate]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    return { start: minDate, end: maxDate };
  };

  const dateRange = propStartDate && propEndDate 
    ? { start: propStartDate, end: propEndDate }
    : calculateDateRange();

  const startDate = dateRange.start;
  const endDate = dateRange.end;

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const taskListScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headerEl = headerScrollRef.current;
    const gridEl = gridScrollRef.current;
    const taskListEl = taskListScrollRef.current;
    if (!headerEl || !gridEl || !taskListEl) return;

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
      taskListEl.scrollTop = gridEl.scrollTop;
      syncing = false;
    };

    const onTaskListScroll = () => {
      if (syncing) return;
      syncing = true;
      gridEl.scrollTop = taskListEl.scrollTop;
      syncing = false;
    };

    headerEl.addEventListener("scroll", onHeaderScroll);
    gridEl.addEventListener("scroll", onGridScroll);
    taskListEl.addEventListener("scroll", onTaskListScroll);

    return () => {
      headerEl.removeEventListener("scroll", onHeaderScroll);
      gridEl.removeEventListener("scroll", onGridScroll);
      taskListEl.removeEventListener("scroll", onTaskListScroll);
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((task) => task.id === active.id);
    const newIndex = tasks.findIndex((task) => task.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
      onUpdateTasks(reorderedTasks);
    }
  };

  const taskIds = tasks.map((task) => task.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
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
          <div className="shrink-0" style={{ width: `${TASK_LIST_WIDTH}px` }}>
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <DraggableTaskList
                tasks={tasks}
                rowHeight={ROW_HEIGHT}
                onTaskClick={onTaskClick}
                onToggleExpand={handleToggleExpand}
                scrollRef={taskListScrollRef}
              />
            </SortableContext>
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
    </DndContext>
  );
};

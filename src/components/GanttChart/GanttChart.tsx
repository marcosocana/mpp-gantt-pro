import { useEffect, useRef } from "react";
import { Task } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { DraggableTaskList } from "./DraggableTaskList";
import { GanttGrid } from "./GanttGrid";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
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

  const handleToggleExpand = async (taskId: string) => {
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

    const updatedTasks = toggleInTasks(tasks);
    
    // Guardar el estado de expansión en la base de datos
    const findAndSaveTask = async (tasks: Task[]): Promise<void> => {
      for (const task of tasks) {
        if (task.id === taskId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('tasks')
              .update({ is_expanded: !task.isExpanded })
              .eq('id', taskId);
          }
          return;
        }
        if (task.children) {
          await findAndSaveTask(task.children);
        }
      }
    };

    await findAndSaveTask(tasks);
    onUpdateTasks(updatedTasks);
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

    // Find the dragged item and target in the hierarchy
    const findTaskAndParent = (tasks: Task[], taskId: string, parent: Task | null = null): { task: Task | null, parent: Task | null, siblings: Task[] } => {
      for (const task of tasks) {
        if (task.id === taskId) {
          return { task, parent, siblings: tasks };
        }
        if (task.children) {
          const result = findTaskAndParent(task.children, taskId, task);
          if (result.task) return result;
        }
      }
      return { task: null, parent: null, siblings: [] };
    };

    const activeInfo = findTaskAndParent(tasks, active.id as string);
    const overInfo = findTaskAndParent(tasks, over.id as string);

    if (!activeInfo.task || !overInfo.task) return;

    // Only allow reordering within the same parent level
    if (activeInfo.parent?.id !== overInfo.parent?.id) return;

    const siblings = activeInfo.siblings;
    const oldIndex = siblings.findIndex(t => t.id === active.id);
    const newIndex = siblings.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex);
      
      // Reconstruct the task tree with reordered siblings
      const updateTaskTree = (tasks: Task[]): Task[] => {
        return tasks.map(task => {
          if (activeInfo.parent && task.id === activeInfo.parent.id) {
            return { ...task, children: reorderedSiblings };
          }
          if (task.children) {
            return { ...task, children: updateTaskTree(task.children) };
          }
          return task;
        });
      };

      const updatedTasks = activeInfo.parent 
        ? updateTaskTree(tasks)
        : reorderedSiblings;

      onUpdateTasks(updatedTasks);
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
        <div className="flex border-b border-border shrink-0 sticky top-0 z-10 bg-card">
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

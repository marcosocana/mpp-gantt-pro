import { useEffect, useRef, useState } from "react";
import { Task } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { DraggableTaskList } from "./DraggableTaskList";
import { GanttGrid } from "./GanttGrid";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
  isViewerMode?: boolean;
}

export const GanttChart = ({ tasks, onTaskClick, onUpdateTasks, startDate: propStartDate, endDate: propEndDate, isViewerMode = false }: GanttChartProps) => {
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom percentage (100 = default)
  const [taskListSize, setTaskListSize] = useState(25); // Percentage of width for task list
  const BASE_DAY_WIDTH = 40;
  const DAY_WIDTH = (BASE_DAY_WIDTH * zoomLevel) / 100;
  const ROW_HEIGHT = 48;

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

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  return (
    <DndContext
      sensors={isViewerMode ? [] : sensors}
      collisionDetection={closestCenter}
      onDragEnd={isViewerMode ? () => {} : handleDragEnd}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Zoom controls */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
          <span className="text-sm font-medium">Zoom:</span>
          <Button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 50}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleZoomReset}
            variant="outline"
            size="sm"
            className="h-8 px-3"
          >
            {zoomLevel}%
          </Button>
          <Button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Header row */}
        <div className="flex border-b border-border shrink-0 sticky top-0 z-10 bg-card">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel
              defaultSize={taskListSize}
              minSize={15}
              maxSize={50}
              onResize={(size) => setTaskListSize(size)}
            >
              <div className="bg-card border-r border-border flex items-center px-4 py-2 h-full">
                <h2 className="font-semibold text-sm">Título</h2>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={100 - taskListSize}>
              <div className="overflow-x-auto overflow-y-hidden h-full" ref={headerScrollRef}>
                <GanttHeader
                  startDate={startDate}
                  endDate={endDate}
                  dayWidth={DAY_WIDTH}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel
              defaultSize={taskListSize}
              minSize={15}
              maxSize={50}
            >
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <DraggableTaskList
                  tasks={tasks}
                  rowHeight={ROW_HEIGHT}
                  onTaskClick={onTaskClick}
                  onToggleExpand={isViewerMode ? () => {} : handleToggleExpand}
                  scrollRef={taskListScrollRef}
                />
              </SortableContext>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={100 - taskListSize}>
              <GanttGrid
                tasks={tasks}
                startDate={startDate}
                endDate={endDate}
                dayWidth={DAY_WIDTH}
                rowHeight={ROW_HEIGHT}
                onTaskClick={onTaskClick}
                scrollRef={gridScrollRef}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </DndContext>
  );
};

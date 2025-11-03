import { Task } from "@/types/gantt";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface DraggableTaskItemProps {
  task: Task;
  level: number;
  rowHeight: number;
  onTaskClick: (task: Task) => void;
  onToggleExpand: (taskId: string) => void;
}

const DraggableTaskItem = ({
  task,
  level,
  rowHeight,
  onTaskClick,
  onToggleExpand,
}: DraggableTaskItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = task.children && task.children.length > 0;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center border-b border-border hover:bg-secondary/50 cursor-pointer group ${
          task.type === 'section' ? 'bg-muted/30 font-semibold' : ''
        }`}
        style={{ height: `${rowHeight}px`, paddingLeft: `${level * 24 + 8}px` }}
        onClick={() => onTaskClick(task)}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 mr-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {hasChildren || task.type === 'section' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 mr-2"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(task.id);
            }}
          >
            {task.isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6 mr-2" />
        )}
        
        <span className={`text-sm truncate flex-1 ${task.type === 'section' ? 'font-semibold' : ''}`}>
          {task.title}
        </span>
      </div>
      
      {hasChildren && task.isExpanded && (
        <SortableContext items={task.children!.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div>
            {task.children!.map(child => (
              <DraggableTaskItem
                key={child.id}
                task={child}
                level={level + 1}
                rowHeight={rowHeight}
                onTaskClick={onTaskClick}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

interface DraggableTaskListProps {
  tasks: Task[];
  rowHeight: number;
  onTaskClick: (task: Task) => void;
  onToggleExpand: (taskId: string) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
}

export const DraggableTaskList = ({
  tasks,
  rowHeight,
  onTaskClick,
  onToggleExpand,
  scrollRef,
}: DraggableTaskListProps) => {
  return (
    <div ref={scrollRef} className="bg-card border-r border-border h-full overflow-y-auto">
      {tasks.map(task => (
        <DraggableTaskItem
          key={task.id}
          task={task}
          level={0}
          rowHeight={rowHeight}
          onTaskClick={onTaskClick}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
};

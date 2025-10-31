import { Task } from "@/types/gantt";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskListProps {
  tasks: Task[];
  rowHeight: number;
  onTaskClick: (task: Task) => void;
  onToggleExpand: (taskId: string) => void;
}

export const TaskList = ({ tasks, rowHeight, onTaskClick, onToggleExpand }: TaskListProps) => {
  const renderTask = (task: Task, level: number = 0) => {
    const hasChildren = task.children && task.children.length > 0;
    
    return (
      <div key={task.id}>
        <div
          className="flex items-center border-b border-border hover:bg-secondary/50 cursor-pointer group"
          style={{ height: `${rowHeight}px`, paddingLeft: `${level * 24 + 8}px` }}
          onClick={() => onTaskClick(task)}
        >
          {hasChildren ? (
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
          
          <span className="text-sm truncate flex-1">{task.title}</span>
        </div>
        
        {hasChildren && task.isExpanded && (
          <div>
            {task.children!.map(child => renderTask(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border-r border-border overflow-y-auto">
      {tasks.map(task => renderTask(task))}
    </div>
  );
};

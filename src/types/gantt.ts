export interface Task {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  type: 'task' | 'section';
  dependencies: string[];
  color?: string;
  parentId?: string;
  children?: Task[];
  isExpanded?: boolean;
  position: number;
  userId?: string;
}

export interface GanttData {
  tasks: Task[];
}

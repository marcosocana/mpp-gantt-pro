export interface Task {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  dependencies: string[];
  parentId?: string;
  children?: Task[];
  isExpanded?: boolean;
}

export interface GanttData {
  tasks: Task[];
}

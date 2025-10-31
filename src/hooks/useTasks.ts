import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/gantt';
import { useToast } from '@/hooks/use-toast';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) throw error;

      // Build tree structure
      const taskMap = new Map<string, Task>();
      const rootTasks: Task[] = [];

      data?.forEach((task) => {
        const taskObj: Task = {
          id: task.id,
          title: task.title,
          startDate: new Date(task.start_date),
          endDate: new Date(task.end_date),
          progress: task.progress,
          type: task.task_type as 'task' | 'section',
          dependencies: task.dependencies || [],
          parentId: task.parent_id || undefined,
          isExpanded: task.is_expanded,
          position: task.position,
          userId: task.user_id,
          children: [],
        };
        taskMap.set(task.id, taskObj);
      });

      taskMap.forEach((task) => {
        if (task.parentId) {
          const parent = taskMap.get(task.parentId);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(task);
          }
        } else {
          rootTasks.push(task);
        }
      });

      setTasks(rootTasks);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTask = async (task: Task) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const taskData = {
        id: task.id,
        user_id: user.id,
        title: task.title,
        start_date: task.startDate.toISOString().split('T')[0],
        end_date: task.endDate.toISOString().split('T')[0],
        progress: task.progress,
        task_type: task.type,
        parent_id: task.parentId || null,
        position: task.position,
        is_expanded: task.isExpanded ?? true,
        dependencies: task.dependencies,
      };

      const { error } = await supabase
        .from('tasks')
        .upsert(taskData);

      if (error) throw error;

      await fetchTasks();
      
      toast({
        title: "Éxito",
        description: "Tarea guardada correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      await fetchTasks();
      
      toast({
        title: "Éxito",
        description: "Tarea eliminada correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTasksOrder = async (updatedTasks: Task[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const flattenTasks = (tasks: Task[], parentId?: string): any[] => {
        return tasks.flatMap((task, index) => {
          const current = {
            id: task.id,
            user_id: user.id,
            title: task.title,
            start_date: task.startDate.toISOString().split('T')[0],
            end_date: task.endDate.toISOString().split('T')[0],
            progress: task.progress,
            task_type: task.type,
            parent_id: parentId || null,
            position: index,
            is_expanded: task.isExpanded ?? true,
            dependencies: task.dependencies,
          };
          
          const children = task.children ? flattenTasks(task.children, task.id) : [];
          return [current, ...children];
        });
      };

      const tasksToUpdate = flattenTasks(updatedTasks);

      const { error } = await supabase
        .from('tasks')
        .upsert(tasksToUpdate);

      if (error) throw error;

      setTasks(updatedTasks);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTasks();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    tasks,
    loading,
    saveTask,
    deleteTask,
    updateTasksOrder,
    refetch: fetchTasks,
  };
};

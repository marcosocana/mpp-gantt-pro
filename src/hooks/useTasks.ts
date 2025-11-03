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
      if (!user) {
        setLoading(false);
        return;
      }

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
          color: task.color || '#3b82f6',
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

      // Calcular fechas de las secciones basándose en sus tareas hijas
      const calculateSectionDates = (task: Task) => {
        if (task.children && task.children.length > 0) {
          // Primero calcular fechas de las secciones hijas
          task.children.forEach(child => calculateSectionDates(child));
          
          // Si es una sección, calcular sus fechas basándose en las tareas hijas
          if (task.type === 'section') {
            const childDates = task.children.flatMap(child => [child.startDate, child.endDate]);
            if (childDates.length > 0) {
              task.startDate = new Date(Math.min(...childDates.map(d => d.getTime())));
              task.endDate = new Date(Math.max(...childDates.map(d => d.getTime())));
            }
          }
        }
      };

      rootTasks.forEach(task => calculateSectionDates(task));

      setTasks(rootTasks);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveTask = async (task: Task, previousType?: 'task' | 'section') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const taskData: any = {
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
        color: task.color || '#3b82f6',
      };

      // Solo incluir el ID si ya existe (para actualizaciones)
      if (task.id && !task.id.startsWith('task-') && !task.id.startsWith('section-')) {
        taskData.id = task.id;
      }

      const { error } = await supabase
        .from('tasks')
        .upsert(taskData);

      if (error) throw error;

      // Si cambió de tarea a sección, reorganizar las tareas siguientes
      if (previousType === 'task' && task.type === 'section') {
        await reorganizeTasksAfterConversion(task.id, task.parentId || null, task.position);
      }

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

  const reorganizeTasksAfterConversion = async (sectionId: string, sectionParentId: string | null, sectionPosition: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      // Obtener todas las tareas del usuario
      const { data: allTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      // Filtrar tareas que están en el mismo nivel que la sección convertida
      const siblingTasks = allTasks?.filter(t => 
        (t.parent_id === sectionParentId || (!t.parent_id && !sectionParentId)) && 
        t.position > sectionPosition &&
        t.id !== sectionId
      ) || [];

      // Encontrar tareas que deben convertirse en hijos (hasta la siguiente sección)
      const tasksToMove: any[] = [];
      for (const task of siblingTasks) {
        if (task.task_type === 'section') {
          break; // Parar al encontrar otra sección
        }
        tasksToMove.push(task);
      }

      // Actualizar las tareas para que sean hijos de la nueva sección
      if (tasksToMove.length > 0) {
        const updates = tasksToMove.map((task, index) => ({
          ...task,
          parent_id: sectionId,
          position: index,
        }));

        const { error: updateError } = await supabase
          .from('tasks')
          .upsert(updates);

        if (updateError) throw updateError;
      }
    } catch (error: any) {
      console.error('Error reorganizing tasks:', error);
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
          const current: any = {
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
            color: task.color || '#3b82f6',
          };

          // Solo incluir ID si es válido (no es temporal)
          if (task.id && !task.id.startsWith('task-') && !task.id.startsWith('section-')) {
            current.id = task.id;
          }
          
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

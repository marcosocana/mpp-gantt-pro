import { useState } from "react";
import { Task } from "@/types/gantt";
import { GanttChart } from "@/components/GanttChart/GanttChart";
import { TaskDialog } from "@/components/GanttChart/TaskDialog";
import { Toolbar } from "@/components/Toolbar";
import { toast } from "sonner";

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1.1",
      title: "Implementación",
      startDate: new Date(2025, 10, 4),
      endDate: new Date(2025, 10, 20),
      progress: 0,
      dependencies: [],
      isExpanded: true,
      children: [
        {
          id: "1.1.7",
          title: "Hito: RFC SAP",
          startDate: new Date(2025, 10, 4),
          endDate: new Date(2025, 10, 5),
          progress: 100,
          dependencies: [],
        },
        {
          id: "1.1.8",
          title: "Hito: Catálogo de datos SAP",
          startDate: new Date(2025, 10, 5),
          endDate: new Date(2025, 10, 6),
          progress: 100,
          dependencies: ["1.1.7"],
        },
        {
          id: "1.1.9",
          title: "Implantación Microservicios",
          startDate: new Date(2025, 10, 6),
          endDate: new Date(2025, 10, 8),
          progress: 80,
          dependencies: ["1.1.8"],
        },
        {
          id: "1.1.10",
          title: "Implantación Web",
          startDate: new Date(2025, 10, 6),
          endDate: new Date(2025, 10, 8),
          progress: 80,
          dependencies: ["1.1.8"],
        },
        {
          id: "1.1.11",
          title: "Implantación APP",
          startDate: new Date(2025, 10, 6),
          endDate: new Date(2025, 10, 8),
          progress: 75,
          dependencies: ["1.1.8"],
        },
        {
          id: "1.1.12",
          title: "Proceso SQL y Carga de datos",
          startDate: new Date(2025, 10, 6),
          endDate: new Date(2025, 10, 11),
          progress: 60,
          dependencies: ["1.1.8"],
        },
        {
          id: "1.1.13",
          title: "Integración con SAP",
          startDate: new Date(2025, 10, 11),
          endDate: new Date(2025, 10, 15),
          progress: 40,
          dependencies: ["1.1.12"],
        },
        {
          id: "1.1.14",
          title: "Despliegue entorno DEV Moeve",
          startDate: new Date(2025, 10, 8),
          endDate: new Date(2025, 10, 10),
          progress: 50,
          dependencies: ["1.1.9", "1.1.10", "1.1.11"],
        },
        {
          id: "1.1.15",
          title: "Despliegue entorno DEV Moeve Química",
          startDate: new Date(2025, 10, 15),
          endDate: new Date(2025, 10, 18),
          progress: 20,
          dependencies: ["1.1.14"],
        },
        {
          id: "1.1.16",
          title: "Pruebas internas",
          startDate: new Date(2025, 10, 18),
          endDate: new Date(2025, 10, 20),
          progress: 0,
          dependencies: ["1.1.15"],
        },
      ],
    },
    {
      id: "1.2",
      title: "Integración",
      startDate: new Date(2025, 10, 4),
      endDate: new Date(2025, 10, 25),
      progress: 0,
      dependencies: [],
      isExpanded: false,
      children: [
        {
          id: "1.2.1",
          title: "Hito: Datos de configuración Tenant",
          startDate: new Date(2025, 10, 4),
          endDate: new Date(2025, 10, 20),
          progress: 0,
          dependencies: [],
        },
      ],
    },
  ]);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleSaveTask = (updatedTask: Task) => {
    const updateTaskInTree = (tasks: Task[]): Task[] => {
      return tasks.map(task => {
        if (task.id === updatedTask.id) {
          return updatedTask;
        }
        if (task.children) {
          return { ...task, children: updateTaskInTree(task.children) };
        }
        return task;
      });
    };

    setTasks(updateTaskInTree(tasks));
    toast.success("Tarea actualizada");
  };

  const handleDeleteTask = (taskId: string) => {
    const deleteTaskFromTree = (tasks: Task[]): Task[] => {
      return tasks
        .filter(task => task.id !== taskId)
        .map(task => {
          if (task.children) {
            return { ...task, children: deleteTaskFromTree(task.children) };
          }
          return task;
        });
    };

    setTasks(deleteTaskFromTree(tasks));
    toast.success("Tarea eliminada");
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `new-${Date.now()}`,
      title: "Nueva tarea",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      progress: 0,
      dependencies: [],
    };

    setTasks([...tasks, newTask]);
    toast.success("Tarea creada");
  };

  const handleImport = () => {
    toast.info("Importar archivo .mpp - Próximamente");
  };

  const handleExport = () => {
    toast.info("Exportar proyecto - Próximamente");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-bold">Gestor de Proyectos Gantt</h1>
      </header>

      <Toolbar
        onAddTask={handleAddTask}
        onImport={handleImport}
        onExport={handleExport}
      />

      <div className="flex-1 overflow-hidden">
        <GanttChart
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onUpdateTasks={setTasks}
        />
      </div>

      <TaskDialog
        task={selectedTask}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
};

export default Index;

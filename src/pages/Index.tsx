import { useState, useEffect } from "react";
import { Task } from "@/types/gantt";
import { GanttChart } from "@/components/GanttChart/GanttChart";
import { TaskDialog } from "@/components/GanttChart/TaskDialog";
import { Toolbar } from "@/components/Toolbar";
import { PasswordLogin } from "@/components/PasswordLogin";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const auth = sessionStorage.getItem("gantt_authenticated");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

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
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const importedTasks: Task[] = [];
          let currentSection: Task | null = null;

          jsonData.forEach((row: any) => {
            const isSection = row["Tipo"] === "Sección" || !row["Tipo"];
            
            if (isSection) {
              currentSection = {
                id: row["ID"] || `section-${Date.now()}-${Math.random()}`,
                title: row["Título"] || row["Nombre"] || "Sin título",
                startDate: row["Fecha Inicio"] ? new Date(row["Fecha Inicio"]) : new Date(),
                endDate: row["Fecha Fin"] ? new Date(row["Fecha Fin"]) : new Date(),
                progress: Number(row["Progreso (%)"]) || 0,
                dependencies: [],
                isExpanded: true,
                children: [],
              };
              importedTasks.push(currentSection);
            } else {
              const task: Task = {
                id: row["ID"] || `task-${Date.now()}-${Math.random()}`,
                title: row["Título"] || row["Nombre"] || "Sin título",
                startDate: row["Fecha Inicio"] ? new Date(row["Fecha Inicio"]) : new Date(),
                endDate: row["Fecha Fin"] ? new Date(row["Fecha Fin"]) : new Date(),
                progress: Number(row["Progreso (%)"]) || 0,
                dependencies: row["Dependencias"] ? row["Dependencias"].split(",").map((d: string) => d.trim()) : [],
              };

              if (currentSection) {
                currentSection.children?.push(task);
              } else {
                importedTasks.push(task);
              }
            }
          });

          setTasks(importedTasks);
          toast.success("Proyecto importado correctamente");
        } catch (error) {
          console.error("Error importing:", error);
          toast.error("Error al importar el archivo");
        }
      };
      reader.readAsBinaryString(file);
    };
    input.click();
  };

  const handleExport = () => {
    const exportData: any[] = [];

    const flattenTasks = (tasks: Task[], parentType?: string) => {
      tasks.forEach((task) => {
        const isSection = task.children && task.children.length > 0;
        
        exportData.push({
          "ID": task.id,
          "Tipo": isSection ? "Sección" : "Tarea",
          "Título": task.title,
          "Fecha Inicio": task.startDate.toISOString().split("T")[0],
          "Fecha Fin": task.endDate.toISOString().split("T")[0],
          "Progreso (%)": task.progress,
          "Dependencias": task.dependencies?.join(", ") || "",
        });

        if (task.children) {
          flattenTasks(task.children, "Tarea");
        }
      });
    };

    flattenTasks(tasks);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gantt");

    XLSX.writeFile(workbook, `gantt-project-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Proyecto exportado correctamente");
  };

  if (!isAuthenticated) {
    return <PasswordLogin onAuthenticated={() => setIsAuthenticated(true)} />;
  }

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

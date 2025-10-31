import { useState, useEffect, useRef } from "react";
import { Task } from "@/types/gantt";
import { GanttChart } from "@/components/GanttChart/GanttChart";
import { TaskDialog } from "@/components/GanttChart/TaskDialog";
import { Toolbar } from "@/components/Toolbar";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useTasks } from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [projectSettings, setProjectSettings] = useState({
    name: "Gestor de Proyectos Gantt",
    startDate: new Date(2025, 10, 1),
    endDate: new Date(2025, 11, 31),
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);
  const { tasks, loading, saveTask, deleteTask, updateTasksOrder } = useTasks();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Inicio de sesión exitoso");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      toast.success("Registro exitoso. Por favor inicia sesión.");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleSaveTask = async (updatedTask: Task) => {
    await saveTask(updatedTask);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const handleAddSection = async () => {
    const newSection: Task = {
      id: `section-${Date.now()}`,
      title: "Nueva Sección",
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      progress: 0,
      type: 'section',
      dependencies: [],
      isExpanded: true,
      position: tasks.length,
      children: [],
    };

    await saveTask(newSection);
  };

  const handleAddTask = async () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: "Nueva tarea",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      progress: 0,
      type: 'task',
      dependencies: [],
      position: tasks.length,
    };

    await saveTask(newTask);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const importedTasks: Task[] = [];
          let currentSection: Task | null = null;
          let position = 0;

          const parseDate = (dateValue: any): Date => {
            if (!dateValue) return new Date();
            
            if (typeof dateValue === 'number') {
              const excelEpoch = new Date(1899, 11, 30);
              const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
              return date;
            }
            
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
          };

          for (const row of jsonData as any[]) {
            const isSection = row["Tipo"] === "Sección";
            
            if (isSection) {
              currentSection = {
                id: `section-${Date.now()}-${Math.random()}`,
                title: row["Título"] || "Sin título",
                startDate: parseDate(row["Fecha Inicio"]),
                endDate: parseDate(row["Fecha Fin"]),
                progress: Number(row["Progreso (%)"]) || 0,
                type: 'section',
                dependencies: [],
                isExpanded: true,
                position: position++,
                children: [],
              };
              importedTasks.push(currentSection);
              await saveTask(currentSection);
            } else {
              const task: Task = {
                id: `task-${Date.now()}-${Math.random()}`,
                title: row["Título"] || "Sin título",
                startDate: parseDate(row["Fecha Inicio"]),
                endDate: parseDate(row["Fecha Fin"]),
                progress: Number(row["Progreso (%)"]) || 0,
                type: 'task',
                dependencies: row["Dependencias"] ? row["Dependencias"].split(",").map((d: string) => d.trim()) : [],
                position: position++,
                parentId: currentSection?.id,
              };

              if (currentSection) {
                currentSection.children?.push(task);
              } else {
                importedTasks.push(task);
              }
              await saveTask(task);
            }
          }

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

    const formatDate = (date: Date) => {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return new Date().toISOString().split("T")[0];
      }
      return date.toISOString().split("T")[0];
    };

    const flattenTasks = (tasks: Task[]) => {
      tasks.forEach((task) => {
        exportData.push({
          "Tipo": task.type === 'section' ? "Sección" : "Tarea",
          "Título": task.title,
          "Fecha Inicio": formatDate(task.startDate),
          "Fecha Fin": formatDate(task.endDate),
          "Progreso (%)": task.progress,
          "Dependencias": task.dependencies?.join(", ") || "",
        });

        if (task.children) {
          flattenTasks(task.children);
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

  const handleExportPDF = async () => {
    if (!ganttRef.current) return;

    toast.info("Generando PDF...");

    try {
      const canvas = await html2canvas(ganttRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: ganttRef.current.scrollWidth,
        height: ganttRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${projectSettings.name}-${new Date().toISOString().split("T")[0]}.pdf`);
      
      toast.success("PDF exportado correctamente");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Gestor de Proyectos Gantt</CardTitle>
            <CardDescription>Inicia sesión o regístrate para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Iniciar Sesión
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Registrarse
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{projectSettings.name}</h1>
        <Button variant="outline" onClick={handleLogout}>
          Cerrar Sesión
        </Button>
      </header>

      <Toolbar
        onAddSection={handleAddSection}
        onAddTask={handleAddTask}
        onImport={handleImport}
        onExport={handleExport}
        onExportPDF={handleExportPDF}
        onProjectSettings={() => setSettingsDialogOpen(true)}
      />

      <div className="flex-1 overflow-hidden" ref={ganttRef}>
        <GanttChart
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onUpdateTasks={updateTasksOrder}
          startDate={projectSettings.startDate}
          endDate={projectSettings.endDate}
        />
      </div>

      <TaskDialog
        task={selectedTask}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />

      <ProjectSettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        settings={projectSettings}
        onSave={setProjectSettings}
      />
    </div>
  );
};

export default Index;

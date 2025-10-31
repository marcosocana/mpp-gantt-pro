import { useState, useEffect, useRef } from "react";
import { Task } from "@/types/gantt";
import { GanttChart } from "@/components/GanttChart/GanttChart";
import { TaskDialog } from "@/components/GanttChart/TaskDialog";
import { Toolbar } from "@/components/Toolbar";
import { PasswordLogin } from "@/components/PasswordLogin";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useTasks } from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("gantt_authenticated") === "true";
  });
  const [isViewerMode] = useState(() => {
    return sessionStorage.getItem("gantt_user_role") === "viewer";
  });
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [projectSettings, setProjectSettings] = useState({
    name: "Gestor de Proyectos Gantt",
    startDate: new Date(2025, 9, 28), // 28 de octubre de 2025 (mes 9 porque enero es 0)
    endDate: new Date(2025, 11, 31),
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);
  const { tasks, loading, saveTask, deleteTask, updateTasksOrder } = useTasks();

  useEffect(() => {
    const auth = sessionStorage.getItem("gantt_authenticated");
    if (auth === "true") {
      setIsAuthenticated(true);
      handleSupabaseAuth();
    }
  }, []);

  const handleSupabaseAuth = async () => {
    try {
      // Usar credenciales fijas para el proyecto
      const email = "admin@gantt.local";
      const password = "Qu!m!ca_2025_Gantt";
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Intentar login primero
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Si falla el login, crear cuenta
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
            },
          });

          if (signUpError) {
            console.error("Error en autenticación:", signUpError);
          } else {
            // Después de crear cuenta, hacer login
            await supabase.auth.signInWithPassword({
              email,
              password,
            });
          }
        }
      }
      
      setIsSupabaseReady(true);
    } catch (error) {
      console.error("Error en autenticación Supabase:", error);
      setIsSupabaseReady(true);
    }
  };

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem("gantt_authenticated", "true");
    handleSupabaseAuth();
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleSaveTask = async (updatedTask: Task) => {
    await saveTask(updatedTask);
    setDialogOpen(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    setDialogOpen(false);
  };

  const handleAddSection = async () => {
    const newSection: Task = {
      id: '', // Dejar vacío para que la BD genere el UUID
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
    toast.success("Sección creada");
  };

  const handleAddTask = async () => {
    const newTask: Task = {
      id: '', // Dejar vacío para que la BD genere el UUID
      title: "Nueva tarea",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      progress: 0,
      type: 'task',
      dependencies: [],
      position: tasks.length,
    };

    await saveTask(newTask);
    toast.success("Tarea creada");
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

          // Primero eliminar todas las tareas existentes
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast.error("No hay usuario autenticado");
            return;
          }

          await supabase.from('tasks').delete().eq('user_id', user.id);

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

          const allRows = jsonData as any[];
          let position = 0;
          
          // Primera pasada: insertar secciones y obtener sus IDs
          const sectionMap = new Map<number, string>(); // índice de fila -> ID de sección
          let currentSectionIdx = -1;
          
          for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            const isSection = row["Tipo"] === "Sección";
            
            if (isSection) {
              const { data, error } = await supabase.from('tasks').insert({
                user_id: user.id,
                title: row["Título"] || "Sin título",
                start_date: parseDate(row["Fecha Inicio"]).toISOString().split('T')[0],
                end_date: parseDate(row["Fecha Fin"]).toISOString().split('T')[0],
                progress: Number(row["Progreso (%)"]) || 0,
                task_type: 'section',
                dependencies: [],
                is_expanded: true,
                position: position++,
                parent_id: null,
              }).select().single();
              
              if (error) throw error;
              if (data) {
                sectionMap.set(i, data.id);
                currentSectionIdx = i;
              }
            }
          }
          
          // Segunda pasada: insertar tareas vinculadas a secciones
          currentSectionIdx = -1;
          for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            const isSection = row["Tipo"] === "Sección";
            
            if (isSection) {
              currentSectionIdx = i;
            } else {
              const parentId = currentSectionIdx >= 0 ? sectionMap.get(currentSectionIdx) : null;
              
              const { error } = await supabase.from('tasks').insert({
                user_id: user.id,
                title: row["Título"] || "Sin título",
                start_date: parseDate(row["Fecha Inicio"]).toISOString().split('T')[0],
                end_date: parseDate(row["Fecha Fin"]).toISOString().split('T')[0],
                progress: Number(row["Progreso (%)"]) || 0,
                task_type: 'task',
                dependencies: row["Dependencias"] ? row["Dependencias"].split(",").map((d: string) => d.trim()) : [],
                position: position++,
                parent_id: parentId,
                is_expanded: true,
              });
              
              if (error) throw error;
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

    const wrapper = ganttRef.current;

    // Guardar estilos originales para restaurar después
    const adjustments: { el: HTMLElement; prev: Partial<CSSStyleDeclaration> }[] = [];

    const pushAdjust = (el: HTMLElement, apply: (el: HTMLElement) => void) => {
      adjustments.push({
        el,
        prev: {
          overflow: el.style.overflow,
          width: el.style.width,
          height: el.style.height,
          maxHeight: el.style.maxHeight,
          maxWidth: el.style.maxWidth,
          position: el.style.position,
        },
      });
      apply(el);
    };

    try {
      // Asegurar que todo el contenido sea visible para la captura
      pushAdjust(wrapper, (el) => {
        el.style.overflow = "visible";
        el.style.width = `${el.scrollWidth}px`;
        el.style.height = `${el.scrollHeight}px`;
        el.style.maxWidth = "none";
        el.style.maxHeight = "none";
      });

      // Expandir contenedores con scroll y quitar sticky para evitar recortes
      const scrollers = wrapper.querySelectorAll<HTMLElement>(
        ".overflow-auto, .overflow-x-auto, .overflow-y-auto, .overflow-hidden"
      );
      scrollers.forEach((el) =>
        pushAdjust(el, (e) => {
          e.style.overflow = "visible";
          e.style.maxHeight = "none";
          e.style.height = "auto";
          e.style.maxWidth = "none";
        })
      );

      const stickies = wrapper.querySelectorAll<HTMLElement>(".sticky");
      stickies.forEach((el) => pushAdjust(el, (e) => (e.style.position = "static")));

      // Forzar scroll al origen
      window.scrollTo(0, 0);

      // Capturar con buena resolución
      const scale = Math.min(2, window.devicePixelRatio || 1.5);

      const canvas = await html2canvas(wrapper, {
        scale,
        useCORS: true,
        logging: false,
        windowWidth: wrapper.scrollWidth,
        windowHeight: wrapper.scrollHeight,
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });

      // Crear PDF multipágina en A4 apaisado
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const imgData = canvas.toDataURL("image/png", 1.0);

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        position -= pageHeight;
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${projectSettings.name}-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exportado correctamente");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Error al exportar PDF");
    } finally {
      // Restaurar estilos
      adjustments.forEach(({ el, prev }) => {
        if (prev.overflow !== undefined) el.style.overflow = prev.overflow as string;
        if (prev.width !== undefined) el.style.width = prev.width as string;
        if (prev.height !== undefined) el.style.height = prev.height as string;
        if (prev.maxHeight !== undefined) el.style.maxHeight = prev.maxHeight as string;
        if (prev.maxWidth !== undefined) el.style.maxWidth = prev.maxWidth as string;
        if (prev.position !== undefined) el.style.position = prev.position as string;
      });
    }
  };

  if (!isAuthenticated) {
    return <PasswordLogin onAuthenticated={handleAuthenticated} />;
  }

  if (!isSupabaseReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-bold">{projectSettings.name}</h1>
      </header>

      {!isViewerMode && (
        <Toolbar
          onAddSection={handleAddSection}
          onAddTask={handleAddTask}
          onImport={handleImport}
          onExport={handleExport}
          onExportPDF={handleExportPDF}
          onProjectSettings={() => setSettingsDialogOpen(true)}
        />
      )}

      <div className="flex-1 overflow-hidden" ref={ganttRef}>
        <GanttChart
          tasks={tasks}
          onTaskClick={isViewerMode ? () => {} : handleTaskClick}
          onUpdateTasks={updateTasksOrder}
          startDate={projectSettings.startDate}
          endDate={projectSettings.endDate}
          isViewerMode={isViewerMode}
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

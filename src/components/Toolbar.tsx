import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Save, FileDown, Settings, FolderPlus } from "lucide-react";

interface ToolbarProps {
  onAddTask: () => void;
  onAddSection: () => void;
  onImport: () => void;
  onExport: () => void;
  onExportPDF: () => void;
  onProjectSettings: () => void;
}

export const Toolbar = ({ onAddTask, onAddSection, onImport, onExport, onExportPDF, onProjectSettings }: ToolbarProps) => {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
      <Button onClick={onProjectSettings} variant="outline" size="sm" className="gap-2">
        <Settings className="h-4 w-4" />
        Configuración
      </Button>
      
      <div className="h-6 w-px bg-border mx-1" />
      
      <Button onClick={onAddSection} size="sm" className="gap-2">
        <FolderPlus className="h-4 w-4" />
        Nueva Sección
      </Button>
      
      <Button onClick={onAddTask} variant="outline" size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Nueva Tarea
      </Button>
      
      <div className="h-6 w-px bg-border mx-1" />
      
      <Button onClick={onImport} variant="outline" size="sm" className="gap-2">
        <FolderOpen className="h-4 w-4" />
        Importar
      </Button>
      
      <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
        <Save className="h-4 w-4" />
        Exportar XLS
      </Button>
      
      <Button onClick={onExportPDF} variant="outline" size="sm" className="gap-2">
        <FileDown className="h-4 w-4" />
        Exportar PDF
      </Button>
    </div>
  );
};

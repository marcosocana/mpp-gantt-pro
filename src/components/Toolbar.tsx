import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Save } from "lucide-react";

interface ToolbarProps {
  onAddTask: () => void;
  onImport: () => void;
  onExport: () => void;
}

export const Toolbar = ({ onAddTask, onImport, onExport }: ToolbarProps) => {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
      <Button onClick={onAddTask} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Nueva Tarea
      </Button>
      
      <Button onClick={onImport} variant="outline" size="sm" className="gap-2">
        <FolderOpen className="h-4 w-4" />
        Importar
      </Button>
      
      <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
        <Save className="h-4 w-4" />
        Exportar
      </Button>
    </div>
  );
};

-- Añadir columna de color a la tabla tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
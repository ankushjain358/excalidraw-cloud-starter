import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { client, blankScene, toWorkspaceFile } from '../lib/client';
import type { Folder, WorkspaceFile } from '../lib/client';

const toFolder = (x: any): Folder => x as Folder;
const toFile = (x: any): WorkspaceFile => x as WorkspaceFile;

export function useWorkspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [drawings, setDrawings] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [{ data: fd, errors: fe }, { data: wd, errors: we }] = await Promise.all([
      client.models.Folder.list(),
      client.models.WorkspaceFile.list(),
    ]);
    if (fe?.length) throw new Error(fe[0].message);
    if (we?.length) throw new Error(we[0].message);
    setFolders((fd ?? []).map(toFolder).sort((a, b) => a.name.localeCompare(b.name)));
    setDrawings((wd ?? []).map(toFile).filter((f) => f.itemType === 'DRAWING'));
    setLoading(false);
  }, []);

  const createFolder = useCallback(async (folderId: string | null) => {
    const name = prompt('Folder name')?.trim();
    if (!name) return;
    const { data, errors } = await client.models.Folder.create({
      name, parentFolderId: folderId ?? undefined,
    } as any);
    if (errors?.length) { toast.error(errors[0].message); return; }
    setFolders((prev) => [...prev, toFolder(data)].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const deleteFolder = useCallback(async (folder: Folder, currentDrawings: WorkspaceFile[]) => {
    const children = currentDrawings.filter((d) => d.folderId === folder.id);
    if (children.length > 0) {
      toast.error(`Move or delete the ${children.length} drawing${children.length > 1 ? 's' : ''} inside "${folder.name}" before deleting it.`);
      return;
    }
    if (!confirm(`Delete folder "${folder.name}"?`)) return;
    const { errors } = await client.models.Folder.delete({ id: folder.id });
    if (errors?.length) { toast.error(errors[0].message); return; }
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
  }, []);

  const createDrawing = useCallback(async (name: string, folderId: string | null, scene: unknown = blankScene): Promise<WorkspaceFile | null> => {
    const { data, errors } = await client.mutations.createDrawing({
      name, folderId: folderId ?? undefined, scene: JSON.stringify(scene) as never,
    });
    if (errors?.length) { toast.error(errors[0].message); return null; }
    const file = toWorkspaceFile(data);
    setDrawings((prev) => [file, ...prev]);
    return file;
  }, []);

  const renameDrawing = useCallback(async (drawing: WorkspaceFile, name: string): Promise<WorkspaceFile> => {
    const trimmed = name.trim();
    const { errors } = await client.models.WorkspaceFile.update({ id: drawing.id, name: trimmed } as any);
    if (errors?.length) { toast.error(errors[0].message); return drawing; }
    const updated = { ...drawing, name: trimmed };
    setDrawings((prev) => prev.map((d) => d.id === drawing.id ? updated : d));
    return updated;
  }, []);

  const deleteDrawing = useCallback(async (drawing: WorkspaceFile): Promise<boolean> => {
    if (!confirm(`Delete "${drawing.name}"?`)) return false;
    const { errors } = await client.models.WorkspaceFile.delete({ id: drawing.id });
    if (errors?.length) { toast.error(errors[0].message); return false; }
    setDrawings((prev) => prev.filter((d) => d.id !== drawing.id));
    return true;
  }, []);

  const updateDrawing = useCallback((updated: WorkspaceFile) => {
    setDrawings((prev) => prev.map((d) => d.id === updated.id ? updated : d));
  }, []);

  const removeDrawing = useCallback((id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    folders, drawings, loading,
    refresh, createFolder, deleteFolder,
    createDrawing, renameDrawing, deleteDrawing,
    updateDrawing, removeDrawing,
  };
}

import { useCallback, useRef, useState } from 'react';
import { serializeAsJSON } from '@excalidraw/excalidraw';
import { toast } from 'sonner';
import { client, blankScene } from '../lib/client';
import type { WorkspaceFile, SaveStatus } from '../lib/client';

export function useDrawingEditor(
  onDrawingUpdated: (drawing: WorkspaceFile) => void,
  onDrawingDeleted: (id: string) => void,
) {
  const [active, setActive] = useState<WorkspaceFile | null>(null);
  const [scene, setScene] = useState<unknown>(blankScene);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [opening, setOpening] = useState(false);

  const api = useRef<any>(null);
  const activeRef = useRef<WorkspaceFile | null>(null);

  const captureScene = useCallback(() =>
    api.current
      ? JSON.parse(serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), 'local'))
      : scene,
  [scene]);

  const updateActiveDrawing = useCallback((drawing: WorkspaceFile) => {
    if (activeRef.current?.id !== drawing.id) return;
    activeRef.current = drawing;
    setActive(drawing);
  }, []);

  const save = useCallback(async () => {
    const current = activeRef.current;
    if (!current || !api.current) return;
    const localScene = captureScene();
    setSaveStatus('saving');
    const { data, errors } = await client.mutations.saveDrawing({
      fileId: current.id, expectedRevision: current.revision, scene: JSON.stringify(localScene) as never,
    });
    if (errors?.length) { setSaveStatus('error'); toast.error(errors[0].message); return; }
    const { revision, updatedAt } = data!;
    const next = { ...current, revision, updatedAt };
    activeRef.current = next;
    setActive(next);
    onDrawingUpdated(next);
    setSaveStatus('saved');
  }, [captureScene, onDrawingUpdated]);

  const openDrawing = useCallback(async (drawing: WorkspaceFile) => {
    setOpening(true);
    try {
      const { data, errors } = await client.queries.loadDrawing({ fileId: drawing.id });
      if (errors?.length) throw new Error(errors[0].message);
      const { file, scene: loadedScene } = data!;
      const parsedScene = typeof loadedScene === 'string' ? JSON.parse(loadedScene) : loadedScene;
      if (!parsedScene || typeof parsedScene !== 'object' || Array.isArray(parsedScene)) {
        throw new Error('Saved drawing data is invalid.');
      }
      activeRef.current = file;
      setActive(file);
      setScene(parsedScene);
      setSaveStatus('saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load drawing.');
    } finally {
      setOpening(false);
    }
  }, []);

  const closeDrawing = useCallback(() => { setActive(null); activeRef.current = null; }, []);

  const deleteActive = useCallback(async () => {
    const current = activeRef.current;
    if (!current || !confirm(`Delete "${current.name}"?`)) return;
    const { errors } = await client.models.WorkspaceFile.delete({ id: current.id });
    if (errors?.length) { toast.error(errors[0].message); return; }
    onDrawingDeleted(current.id);
    setActive(null);
    activeRef.current = null;
  }, [onDrawingDeleted]);

  return { active, scene, saveStatus, opening, api, openDrawing, closeDrawing, save, deleteActive, updateActiveDrawing };
}

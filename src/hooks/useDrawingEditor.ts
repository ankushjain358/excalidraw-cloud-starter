import { useCallback, useEffect, useRef, useState } from 'react';
import { serializeAsJSON } from '@excalidraw/excalidraw';
import { toast } from 'sonner';
import { client, recoveryKey, blankScene } from '../lib/client';
import type { WorkspaceFile, SaveStatus } from '../lib/client';

type Recovery = { scene: unknown; expectedRevision: number };

function getRecovery(id: string): Recovery | null {
  try { return JSON.parse(localStorage.getItem(recoveryKey(id)) ?? '') as Recovery; } catch { return null; }
}

export function useDrawingEditor(
  onDrawingUpdated: (drawing: WorkspaceFile) => void,
  onDrawingDeleted: (id: string) => void,
) {
  const [active, setActive] = useState<WorkspaceFile | null>(null);
  const [scene, setScene] = useState<unknown>(blankScene);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<Recovery | null>(null);

  const api = useRef<any>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeRef = useRef<WorkspaceFile | null>(null);
  const saveChain = useRef(Promise.resolve());

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const captureScene = useCallback(() =>
    api.current
      ? JSON.parse(serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), 'local'))
      : scene,
  [scene]);

  const save = useCallback(() => {
    if (!activeRef.current || !api.current) return;
    const localScene = captureScene();
    let attempted: WorkspaceFile | null = null;
    saveChain.current = saveChain.current.then(async () => {
      const current = activeRef.current;
      if (!current) return;
      attempted = current;
      setSaveStatus(navigator.onLine ? 'saving' : 'offline');
      if (!navigator.onLine) throw new Error('OFFLINE');
      const { data, errors } = await client.mutations.saveDrawing({
        fileId: current.id, expectedRevision: current.revision, scene: JSON.stringify(localScene) as never,
      });
      if (errors?.length) throw new Error(errors[0].message);
      const { revision, updatedAt } = JSON.parse(data!) as { revision: number; updatedAt: string };
      const next = { ...current, revision, updatedAt };
      activeRef.current = next;
      setActive(next);
      onDrawingUpdated(next);
      localStorage.removeItem(recoveryKey(current.id));
      setDirty(false);
      setSaveStatus('saved');
    }).catch((error: Error) => {
      if (!attempted) return;
      localStorage.setItem(recoveryKey(attempted.id), JSON.stringify({ scene: localScene, expectedRevision: attempted.revision }));
      if (error.message.startsWith('CONFLICT:')) { setConflict({ scene: localScene, expectedRevision: attempted.revision }); setSaveStatus('error'); return; }
      setSaveStatus(navigator.onLine ? 'error' : 'offline');
    });
  }, [captureScene, onDrawingUpdated]);

  const scheduleSave = useCallback(() => {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(save, 900);
  }, [save]);

  useEffect(() => {
    const retry = () => { if (activeRef.current && getRecovery(activeRef.current.id)) save(); };
    addEventListener('online', retry);
    return () => removeEventListener('online', retry);
  }, [save]);

  const openDrawing = useCallback(async (drawing: WorkspaceFile) => {
    setConflict(null);
    const local = getRecovery(drawing.id);
    if (local) { setActive(drawing); setScene(local.scene); setDirty(true); setSaveStatus('offline'); return; }
    try {
      const { data, errors } = await client.queries.loadDrawing({ fileId: drawing.id });
      if (errors?.length) throw new Error(errors[0].message);
      const { file, scene: loadedScene } = JSON.parse(data!) as { file: WorkspaceFile; scene: unknown };
      setActive(file); setScene(loadedScene); setDirty(false); setSaveStatus('saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load drawing.');
    }
  }, []);

  const closeDrawing = useCallback((dirty: boolean) => {
    if (dirty && !confirm('Leave with unsaved changes?')) return;
    setActive(null);
    setConflict(null);
  }, []);

  const resolveConflict = useCallback(async (
    action: 'reload' | 'copy',
    createDrawing: (name: string, folderId: string | null, scene: unknown) => Promise<WorkspaceFile | null>,
  ) => {
    if (!activeRef.current || !conflict) return;
    if (action === 'copy') {
      const name = `${activeRef.current.name} (conflict copy)`;
      setConflict(null);
      await createDrawing(name, activeRef.current.folderId ?? null, conflict.scene);
      return;
    }
    const drawing = activeRef.current;
    localStorage.removeItem(recoveryKey(drawing.id));
    setConflict(null);
    await openDrawing(drawing);
  }, [conflict, openDrawing]);

  const deleteActive = useCallback(async () => {
    const current = activeRef.current;
    if (!current || !confirm(`Delete "${current.name}"?`)) return;
    const { errors } = await client.models.WorkspaceFile.delete({ id: current.id });
    if (errors?.length) { toast.error(errors[0].message); return; }
    localStorage.removeItem(recoveryKey(current.id));
    onDrawingDeleted(current.id);
    setActive(null);
  }, [onDrawingDeleted]);

  return { active, scene, saveStatus, dirty, conflict, api, openDrawing, closeDrawing, save, scheduleSave, resolveConflict, deleteActive, setActive };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { Download, FileUp, FolderPlus, Moon, Plus, Save, Sun, Trash2, X } from "lucide-react";
import type { Schema } from "../amplify/data/resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";

const client = generateClient<Schema>();
const recoveryKey = (id: string) => `excalidraw-cloud-starter:recovery:${id}`;
const blankScene = { type: "excalidraw", version: 2, source: "excalidraw-cloud-starter", elements: [], appState: {}, files: {} };
type Folder = { id: string; name: string; parentFolderId: string | null };
type Drawing = { id: string; folderId: string | null; name: string; revision: number; updatedAtUtc: string; itemType: "DRAWING" | "UPLOAD" };
type Recovery = { scene: unknown; expectedRevision: number };

const asFolder = (value: unknown) => value as Folder;
const asDrawing = (value: unknown) => value as Drawing;
function recovery(id: string): Recovery | null {
  try { return JSON.parse(localStorage.getItem(recoveryKey(id)) ?? "") as Recovery; } catch { return null; }
}

export default function App() {
  const auth = useAuthenticator((context) => [context.signOut]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [active, setActive] = useState<Drawing | null>(null);
  const [scene, setScene] = useState<unknown>(blankScene);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"saved" | "saving" | "offline" | "error">("saved");
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState<Recovery | null>(null);
  const api = useRef<any>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeRef = useRef<Drawing | null>(null);
  const saveChain = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    const result = await client.queries.getWorkspace();
    if (result.errors?.length) throw new Error(result.errors[0].message);
    const data = result.data!;
    setFolders((data.folders as Folder[]).sort((a, b) => a.name.localeCompare(b.name)));
    setDrawings((data.files as Drawing[]).filter((file) => file.itemType === "DRAWING"));
  }, []);
  useEffect(() => { void refresh().catch((error) => toast.error(error.message)).finally(() => setLoading(false)); }, [refresh]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const captureScene = () => api.current ? JSON.parse(serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), "local")) : scene;
  const save = useCallback(() => {
    if (!activeRef.current || !api.current) return;
    const localScene = captureScene();
    let attempted: Drawing | null = null;
    saveChain.current = saveChain.current.then(async () => {
      const current = activeRef.current;
      if (!current) return;
      attempted = current;
      setSaving(navigator.onLine ? "saving" : "offline");
      if (!navigator.onLine) throw new Error("OFFLINE");
      const result = await client.mutations.saveDrawing({ fileId: current.id, expectedRevision: current.revision, scene: localScene as never });
      if (result.errors?.length) throw new Error(result.errors[0].message);
      const next = { ...current, revision: result.data!.revision, updatedAtUtc: result.data!.updatedAtUtc };
      activeRef.current = next; setActive(next); setDrawings((items) => items.map((item) => item.id === next.id ? next : item));
      localStorage.removeItem(recoveryKey(current.id)); setDirty(false); setSaving("saved");
    }).catch((error: Error) => {
      if (!attempted) return;
      localStorage.setItem(recoveryKey(attempted.id), JSON.stringify({ scene: localScene, expectedRevision: attempted.revision }));
      if (error.message.startsWith("CONFLICT:")) { setConflict({ scene: localScene, expectedRevision: attempted.revision }); setSaving("error"); return; }
      setSaving(navigator.onLine ? "error" : "offline");
    });
  }, [scene]);
  const scheduleSave = useCallback(() => { setDirty(true); if (timer.current) clearTimeout(timer.current); timer.current = window.setTimeout(save, 900); }, [save]);
  useEffect(() => {
    const retry = () => { if (activeRef.current && recovery(activeRef.current.id)) save(); };
    addEventListener("online", retry); return () => removeEventListener("online", retry);
  }, [save]);

  const openDrawing = async (drawing: Drawing) => {
    setLoading(true); setConflict(null);
    try {
      const local = recovery(drawing.id);
      if (local) { setActive(drawing); setScene(local.scene); setDirty(true); setSaving("offline"); return; }
      const result = await client.queries.loadDrawing({ fileId: drawing.id });
      if (result.errors?.length) throw new Error(result.errors[0].message);
      setActive(asDrawing(result.data!.file)); setScene(result.data!.scene); setDirty(false); setSaving("saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load drawing."); }
    finally { setLoading(false); }
  };
  const createFolder = async () => {
    const name = prompt("Folder name")?.trim(); if (!name) return;
    try { const result = await client.mutations.createFolder({ name, parentFolderId: folderId }); if (result.errors?.length) throw new Error(result.errors[0].message); setFolders((items) => [...items, asFolder(result.data)].sort((a, b) => a.name.localeCompare(b.name))); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create folder."); }
  };
  const createDrawing = async (name = "Untitled drawing", initialScene: unknown = blankScene) => {
    try { const result = await client.mutations.createDrawing({ name, folderId, scene: initialScene as never }); if (result.errors?.length) throw new Error(result.errors[0].message); const drawing = asDrawing(result.data); setDrawings((items) => [drawing, ...items]); setScene(initialScene); setActive(drawing); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create drawing."); }
  };
  const deleteActive = async () => {
    if (!active || !confirm(`Delete ${active.name}?`)) return;
    try { const result = await client.mutations.deleteFile({ fileId: active.id }); if (result.errors?.length) throw new Error(result.errors[0].message); localStorage.removeItem(recoveryKey(active.id)); setDrawings((items) => items.filter((item) => item.id !== active.id)); setActive(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete drawing."); }
  };
  const importScene = async (file?: File) => { if (!file) return; try { await createDrawing(file.name.replace(/\.excalidraw$/i, "") || "Imported drawing", JSON.parse(await file.text())); } catch { toast.error("The selected file is not valid Excalidraw JSON."); } };
  const exportScene = () => { if (!active) return; const blob = new Blob([JSON.stringify(captureScene())], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${active.name}.excalidraw`; link.click(); URL.revokeObjectURL(url); };
  const renameActive = async (name: string) => {
    if (!active || !name.trim()) return;
    const result = await client.mutations.renameFile({ fileId: active.id, name: name.trim() });
    if (result.errors?.length) { toast.error(result.errors[0].message); return; }
    const next = asDrawing(result.data); setActive(next); activeRef.current = next; setDrawings((items) => items.map((item) => item.id === next.id ? next : item));
  };
  const resolveConflict = async (action: "reload" | "copy") => {
    if (!active || !conflict) return;
    if (action === "copy") { const name = `${active.name} (conflict copy)`; setConflict(null); await createDrawing(name, conflict.scene); return; }
    const id = active.id; localStorage.removeItem(recoveryKey(id)); setConflict(null); await openDrawing(drawings.find((item) => item.id === id) ?? active);
  };
  const visible = drawings.filter((drawing) => drawing.folderId === folderId && drawing.name.toLowerCase().includes(query.toLowerCase()));

  if (active) return <main className={dark ? "dark h-screen" : "h-screen"}><div className="flex h-full flex-col bg-background text-foreground"><header className="flex h-14 shrink-0 items-center gap-2 border-b px-3"><Button variant="ghost" size="icon" onClick={() => { if (!dirty || confirm("Leave with unsaved changes?")) setActive(null); }} aria-label="Close editor"><X /></Button><Input defaultValue={active.name} onBlur={(event) => void renameActive(event.target.value)} className="max-w-xs border-0 text-base font-medium shadow-none" /><span className="ml-auto text-sm text-muted-foreground">{saving === "saving" ? "Saving..." : dirty ? "Unsaved" : saving === "offline" ? "Saved locally, offline" : saving === "error" ? "Save failed" : "Saved"}</span><Button size="sm" onClick={save}><Save />Save now</Button><Button variant="outline" size="sm" onClick={exportScene}><Download />Export</Button><Button variant="ghost" size="icon" onClick={() => void deleteActive()} aria-label="Delete drawing"><Trash2 /></Button></header>{conflict && <div className="flex items-center gap-3 border-b bg-amber-50 px-3 py-2 text-sm text-amber-950"><span>Cloud version changed. Your local scene is safely retained.</span><Button size="sm" variant="outline" onClick={() => void resolveConflict("reload")}>Reload cloud</Button><Button size="sm" onClick={() => void resolveConflict("copy")}>Save as copy</Button></div>}<div className="min-h-0 flex-1"><Excalidraw key={active.id} excalidrawAPI={(value) => { api.current = value; }} initialData={scene as any} theme={dark ? "dark" : "light"} onChange={scheduleSave} /></div></div><Toaster /></main>;

  return <main className={dark ? "dark min-h-screen" : "min-h-screen"}><div className="min-h-screen bg-background text-foreground"><header className="flex h-16 items-center gap-3 border-b px-4"><div className="font-semibold tracking-tight">excalidraw-cloud-starter</div><div className="hidden text-sm text-muted-foreground sm:block">Private drawing workspace</div><div className="ml-auto flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button><Button variant="outline" size="sm" onClick={() => auth.signOut()}>Sign out</Button></div></header><div className="flex min-h-[calc(100vh-4rem)]"><aside className="w-64 shrink-0 border-r p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Folders</span><Button variant="ghost" size="icon" onClick={() => void createFolder()} aria-label="New folder"><FolderPlus /></Button></div><button className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm ${folderId === null ? "bg-accent font-medium" : "hover:bg-muted"}`} onClick={() => setFolderId(null)}>All drawings</button>{folders.map((folder) => <div className="group flex items-center" key={folder.id}><button className={`w-full rounded-md px-3 py-2 text-left text-sm ${folderId === folder.id ? "bg-accent font-medium" : "hover:bg-muted"}`} onClick={() => setFolderId(folder.id)}>{folder.name}</button><Button className="invisible group-hover:visible" variant="ghost" size="icon" onClick={() => { if (confirm("Delete this folder and move its drawings to All drawings?")) void client.mutations.deleteFolder({ folderId: folder.id }).then(() => refresh()); }} aria-label={`Delete ${folder.name}`}><Trash2 /></Button></div>)}</aside><section className="min-w-0 flex-1 p-5 sm:p-8"><div className="mb-7 flex flex-wrap items-center gap-3"><div><h1 className="text-2xl font-semibold">{folderId ? folders.find((folder) => folder.id === folderId)?.name : "All drawings"}</h1><p className="text-sm text-muted-foreground">Your private cloud workspace</p></div><div className="ml-auto flex gap-2"><label className="inline-flex cursor-pointer"><input className="sr-only" type="file" accept=".excalidraw,application/json" onChange={(event) => void importScene(event.target.files?.[0])} /><span className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"><FileUp className="size-4" />Import</span></label><Button onClick={() => void createDrawing()}><Plus />New drawing</Button></div></div><Input className="mb-5 max-w-md" placeholder="Search drawings" value={query} onChange={(event) => setQuery(event.target.value)} />{loading ? <p className="text-sm text-muted-foreground">Loading workspace...</p> : visible.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed"><div className="text-center"><p className="font-medium">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">Start a canvas or import an Excalidraw file.</p><Button className="mt-4" onClick={() => void createDrawing()}><Plus />Create drawing</Button></div></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((drawing) => <button key={drawing.id} onClick={() => void openDrawing(drawing)} className="rounded-xl border p-4 text-left transition hover:border-primary hover:shadow-sm"><div className="mb-12 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">*</div><p className="font-medium">{drawing.name}</p><p className="mt-1 text-xs text-muted-foreground">Updated {new Date(drawing.updatedAtUtc).toLocaleString()}</p></button>)}</div>}</section></div></div><Toaster /></main>;
}

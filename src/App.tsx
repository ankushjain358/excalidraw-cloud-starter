import { useEffect, useRef, useState } from 'react';
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Download, FileUp, FolderPlus, Moon, Plus, Save, Sun, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from 'sonner';

type Folder = { id: string; name: string; parentId: string | null };
type Drawing = { id: string; folderId: string | null; name: string; revision: number; updatedAt: string };
const key = 'sketchvault:workspace';
const sceneKey = (id: string) => `sketchvault:scene:${id}`;
const uid = () => crypto.randomUUID();

function load() { try { return JSON.parse(localStorage.getItem(key) || '') as { folders: Folder[]; drawings: Drawing[] }; } catch { return { folders: [], drawings: [] }; } }

export default function App() {
  const auth = useAuthenticator((context) => [context.user, context.signOut]);
  const initial = load();
  const [folders, setFolders] = useState(initial.folders);
  const [drawings, setDrawings] = useState(initial.drawings);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [active, setActive] = useState<Drawing | null>(null);
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const api = useRef<any>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { localStorage.setItem(key, JSON.stringify({ folders, drawings })); }, [folders, drawings]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = () => {
    if (!active || !api.current) return;
    setSaving(navigator.onLine ? 'saving' : 'offline');
    const json = serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), 'local');
    localStorage.setItem(sceneKey(active.id), json);
    const updated = { ...active, revision: active.revision + 1, updatedAt: new Date().toISOString() };
    setDrawings((items) => items.map((item) => item.id === active.id ? updated : item)); setActive(updated); setDirty(false);
    setSaving(navigator.onLine ? 'saved' : 'offline');
  };
  const scheduleSave = () => { setDirty(true); if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(save, 900); };
  const createFolder = () => { const name = prompt('Folder name'); if (name?.trim()) setFolders((x) => [...x, { id: uid(), name: name.trim(), parentId: folderId }]); };
  const createDrawing = () => { const drawing = { id: uid(), folderId, name: 'Untitled drawing', revision: 0, updatedAt: new Date().toISOString() }; setDrawings((x) => [drawing, ...x]); setActive(drawing); };
  const removeActive = () => { if (!active || !confirm(`Delete ${active.name}?`)) return; localStorage.removeItem(sceneKey(active.id)); setDrawings((x) => x.filter((d) => d.id !== active.id)); setActive(null); };
  const importScene = async (file?: File) => { if (!file) return; const drawing = { id: uid(), folderId, name: file.name.replace(/\.excalidraw$/i, ''), revision: 0, updatedAt: new Date().toISOString() }; localStorage.setItem(sceneKey(drawing.id), await file.text()); setDrawings((x) => [drawing, ...x]); setActive(drawing); };
  const exportScene = () => { if (!active) return; const blob = new Blob([localStorage.getItem(sceneKey(active.id)) || '{}'], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${active.name}.excalidraw`; link.click(); URL.revokeObjectURL(url); };
  const visible = drawings.filter((d) => d.folderId === folderId && d.name.toLowerCase().includes(query.toLowerCase()));

  if (active) return <main className={dark ? 'dark h-screen' : 'h-screen'}><div className="flex h-full flex-col bg-background text-foreground"><header className="flex h-14 shrink-0 items-center gap-2 border-b px-3"><Button variant="ghost" size="icon" onClick={() => { if (dirty && !confirm('Leave with unsaved changes?')) return; setActive(null); }} aria-label="Close editor"><X /></Button><Input value={active.name} onChange={(e) => { const next = { ...active, name: e.target.value }; setActive(next); setDrawings((x) => x.map((d) => d.id === next.id ? next : d)); }} className="max-w-xs border-0 text-base font-medium shadow-none" /><span className="ml-auto text-sm text-muted-foreground">{saving === 'saving' ? 'Saving...' : dirty ? 'Unsaved' : saving === 'offline' ? 'Saved locally, offline' : 'Saved'}</span><Button size="sm" onClick={save}><Save />Save now</Button><Button variant="outline" size="sm" onClick={exportScene}><Download />Export</Button><Button variant="ghost" size="icon" onClick={removeActive} aria-label="Delete drawing"><Trash2 /></Button></header><div className="min-h-0 flex-1"><Excalidraw excalidrawAPI={(value) => { api.current = value; }} initialData={localStorage.getItem(sceneKey(active.id)) ? JSON.parse(localStorage.getItem(sceneKey(active.id))!) : undefined} theme={dark ? 'dark' : 'light'} onChange={scheduleSave} /></div></div><Toaster /></main>;

  return <main className={dark ? 'dark min-h-screen' : 'min-h-screen'}><div className="min-h-screen bg-background text-foreground"><header className="flex h-16 items-center gap-3 border-b px-4"><div className="font-semibold tracking-tight">SketchVault</div><div className="hidden text-sm text-muted-foreground sm:block">Private drawing workspace</div><div className="ml-auto flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button><Button variant="outline" size="sm" onClick={() => auth.signOut()}>Sign out</Button></div></header><div className="flex min-h-[calc(100vh-4rem)]"><aside className="w-64 shrink-0 border-r p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Folders</span><Button variant="ghost" size="icon" onClick={createFolder} aria-label="New folder"><FolderPlus /></Button></div><button className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm ${folderId === null ? 'bg-accent font-medium' : 'hover:bg-muted'}`} onClick={() => setFolderId(null)}>All drawings</button>{folders.map((folder) => <div className="group flex items-center" key={folder.id}><button className={`w-full rounded-md px-3 py-2 text-left text-sm ${folderId === folder.id ? 'bg-accent font-medium' : 'hover:bg-muted'}`} onClick={() => setFolderId(folder.id)}>{folder.name}</button><Button className="invisible group-hover:visible" variant="ghost" size="icon" onClick={() => { if (confirm('Delete this folder and move its drawings to All drawings?')) { setDrawings((x) => x.map((d) => d.folderId === folder.id ? { ...d, folderId: null } : d)); setFolders((x) => x.filter((f) => f.id !== folder.id)); if (folderId === folder.id) setFolderId(null); } }} aria-label={`Delete ${folder.name}`}><Trash2 /></Button></div>)}</aside><section className="min-w-0 flex-1 p-5 sm:p-8"><div className="mb-7 flex flex-wrap items-center gap-3"><div><h1 className="text-2xl font-semibold">{folderId ? folders.find((f) => f.id === folderId)?.name : 'All drawings'}</h1><p className="text-sm text-muted-foreground">Your private cloud workspace</p></div><div className="ml-auto flex gap-2"><label className="inline-flex cursor-pointer"><input className="sr-only" type="file" accept=".excalidraw,application/json" onChange={(e) => void importScene(e.target.files?.[0])}/><span className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"><FileUp className="size-4" />Import</span></label><Button onClick={createDrawing}><Plus />New drawing</Button></div></div><Input className="mb-5 max-w-md" placeholder="Search drawings" value={query} onChange={(e) => setQuery(e.target.value)} />{visible.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed"><div className="text-center"><p className="font-medium">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">Start a canvas or import an Excalidraw file.</p><Button className="mt-4" onClick={createDrawing}><Plus />Create drawing</Button></div></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((drawing) => <button key={drawing.id} onClick={() => setActive(drawing)} className="rounded-xl border p-4 text-left transition hover:border-primary hover:shadow-sm"><div className="mb-12 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">✦</div><p className="font-medium">{drawing.name}</p><p className="mt-1 text-xs text-muted-foreground">Updated {new Date(drawing.updatedAt).toLocaleString()}</p></button>)}</div>}</section></div></div><Toaster /></main>;
}

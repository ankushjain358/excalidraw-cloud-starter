import { useState } from 'react';
import { FolderPlus, Loader2, Moon, Plus, Sun, Trash2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthenticator } from '@aws-amplify/ui-react';
import type { Folder, WorkspaceFile } from '../lib/client';

type Props = {
  folders: Folder[];
  drawings: WorkspaceFile[];
  loading: boolean;
  opening: boolean;
  dark: boolean;
  onToggleDark: () => void;
  onOpenDrawing: (drawing: WorkspaceFile) => void;
  onCreateDrawing: () => void;
  onImportDrawing: (file: File) => void;
  onCreateFolder: () => void;
  onDeleteFolder: (folder: Folder) => void;
};

export function WorkspaceView({
  folders, drawings, loading, opening, dark, onToggleDark,
  onOpenDrawing, onCreateDrawing, onImportDrawing,
  onCreateFolder, onDeleteFolder,
}: Props) {
  const { signOut } = useAuthenticator((ctx) => [ctx.signOut]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const visible = drawings.filter(
    (d) => (d.folderId ?? null) === folderId && d.name.toLowerCase().includes(query.toLowerCase())
  );

  const busy = loading || opening;

  const handleOpen = async (drawing: WorkspaceFile) => {
    setOpeningId(drawing.id);
    await onOpenDrawing(drawing);
    setOpeningId(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center gap-3 border-b px-4">
        <div className="font-semibold tracking-tight">excalidraw-cloud-starter</div>
        <div className="hidden text-sm text-muted-foreground sm:block">Private drawing workspace</div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleDark} aria-label="Toggle theme">
            {dark ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" size="lg" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="w-64 shrink-0 border-r p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Folders</span>
            <Button variant="ghost" size="icon" onClick={onCreateFolder} disabled={busy} aria-label="New folder"><FolderPlus /></Button>
          </div>
          <button
            className={`mb-1 w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${folderId === null ? 'bg-accent font-medium' : 'hover:bg-muted'}`}
            onClick={() => setFolderId(null)}
          >
            All drawings
          </button>
          {folders.map((folder) => (
            <div className="group flex items-center" key={folder.id}>
              <button
                className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm ${folderId === folder.id ? 'bg-accent font-medium' : 'hover:bg-muted'}`}
                onClick={() => setFolderId(folder.id)}
              >
                {folder.name}
              </button>
              <Button
                className="invisible group-hover:visible" variant="ghost" size="icon"
                disabled={busy}
                onClick={() => onDeleteFolder(folder)} aria-label={`Delete ${folder.name}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </aside>

        <section className="min-w-0 flex-1 p-5 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold">
                {folderId ? folders.find((f) => f.id === folderId)?.name : 'All drawings'}
              </h1>
              <p className="text-sm text-muted-foreground">Your private cloud workspace</p>
            </div>
            <div className="ml-auto flex gap-2">
              <label className={`inline-flex cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                <input
                  className="sr-only" type="file" accept=".excalidraw,application/json" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportDrawing(f); }}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  <FileUp className="size-4" />Import
                </span>
              </label>
              <Button size="lg" onClick={onCreateDrawing} disabled={busy}><Plus />New drawing</Button>
            </div>
          </div>

          <Input className="mb-5 max-w-md h-10 text-base" placeholder="Search drawings" value={query} onChange={(e) => setQuery(e.target.value)} />

          {loading ? (
            <div className="grid min-h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed">
              <div className="text-center">
                <p className="font-medium">Nothing here yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Start a canvas or import an Excalidraw file.</p>
                <Button size="lg" className="mt-4" onClick={onCreateDrawing} disabled={busy}><Plus />Create drawing</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((drawing) => (
                <button
                  key={drawing.id} onClick={() => handleOpen(drawing)}
                  disabled={opening}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-60"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {openingId === drawing.id ? <Loader2 className="size-4 animate-spin" /> : <span className="text-sm">✦</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{drawing.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(drawing.updatedAt).toLocaleString()}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

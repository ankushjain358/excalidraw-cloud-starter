import { useState } from 'react';
import { Folder as FolderIcon, FolderPlus, Loader2, Moon, MoreHorizontal, Pencil, Plus, Sun, Trash2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuthenticator } from '@aws-amplify/ui-react';
import type { Folder, WorkspaceFile } from '../lib/client';

type Props = {
  folders: Folder[];
  drawings: WorkspaceFile[];
  loading: boolean;
  opening: boolean;
  dark: boolean;
  folderId: string | null;
  onFolderChange: (id: string | null) => void;
  onToggleDark: () => void;
  onOpenDrawing: (drawing: WorkspaceFile) => void;
  onCreateDrawing: () => void;
  onImportDrawing: (file: File) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: Folder, name: string) => Promise<boolean> | boolean;
  onDeleteFolder: (folder: Folder) => void;
  onMoveDrawing: (drawing: WorkspaceFile, folderId: string | null) => Promise<boolean> | boolean;
};

export function WorkspaceView({
  folders, drawings, loading, opening, dark, folderId, onFolderChange, onToggleDark,
  onOpenDrawing, onCreateDrawing, onImportDrawing,
  onCreateFolder, onRenameFolder, onDeleteFolder, onMoveDrawing,
}: Props) {
  const { signOut } = useAuthenticator((ctx) => [ctx.signOut]);
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [savingFolderName, setSavingFolderName] = useState(false);
  const [movingDrawing, setMovingDrawing] = useState<WorkspaceFile | null>(null);
  const [savingMove, setSavingMove] = useState(false);

  const visible = drawings.filter(
    (d) => (d.folderId ?? null) === folderId && d.name.toLowerCase().includes(query.toLowerCase())
  );

  const busy = loading || opening;

  const handleOpen = async (drawing: WorkspaceFile) => {
    setOpeningId(drawing.id);
    await onOpenDrawing(drawing);
    setOpeningId(null);
  };

  const handleRenameFolder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!renamingFolder || !name || savingFolderName) return;
    setSavingFolderName(true);
    try {
      if (await onRenameFolder(renamingFolder, name)) setRenamingFolder(null);
    } finally {
      setSavingFolderName(false);
    }
  };

  const handleMoveDrawing = async (targetFolderId: string | null) => {
    if (!movingDrawing || savingMove) return;
    setSavingMove(true);
    try {
      if (await onMoveDrawing(movingDrawing, targetFolderId)) setMovingDrawing(null);
    } finally {
      setSavingMove(false);
    }
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
            onClick={() => onFolderChange(null)}
          >
            All drawings
          </button>
          {folders.map((folder) => (
            <div className="group flex items-center" key={folder.id}>
              <button
                className={`min-w-0 flex-1 cursor-pointer truncate rounded-md px-3 py-2 text-left text-sm ${folderId === folder.id ? 'bg-accent font-medium' : 'hover:bg-muted'}`}
                onClick={() => onFolderChange(folder.id)}
              >
                {folder.name}
              </button>
              <div className="flex shrink-0">
                <Button
                  className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" variant="ghost" size="icon"
                  disabled={busy}
                  onClick={() => { setRenamingFolder(folder); setFolderName(folder.name); }} aria-label={`Rename ${folder.name}`}
                >
                  <Pencil />
                </Button>
                <Button
                  className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" variant="ghost" size="icon"
                  disabled={busy}
                  onClick={() => onDeleteFolder(folder)} aria-label={`Delete ${folder.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
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
                <div
                  key={drawing.id}
                  className="flex min-w-0 items-center rounded-lg border transition hover:border-primary hover:shadow-sm"
                >
                  <button
                    onClick={() => handleOpen(drawing)}
                    disabled={opening}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-l-lg px-3 py-2.5 text-left disabled:opacity-60"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      {openingId === drawing.id ? <Loader2 className="size-4 animate-spin" /> : <span className="text-sm">✦</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{drawing.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(drawing.updatedAt).toLocaleString()}</p>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="mr-1 shrink-0" aria-label={`More options for ${drawing.name}`} disabled={busy} />}
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setMovingDrawing(drawing)}>
                        <FolderIcon />Move
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={renamingFolder !== null}
        onOpenChange={(open) => { if (!open && !savingFolderName) setRenamingFolder(null); }}
      >
        <DialogContent>
          <form onSubmit={handleRenameFolder}>
            <DialogHeader>
              <DialogTitle>Rename folder</DialogTitle>
              <DialogDescription>Choose a new name for “{renamingFolder?.name}”.</DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              className="my-4"
              aria-label="Folder name"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              maxLength={100}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenamingFolder(null)} disabled={savingFolderName}>Cancel</Button>
              <Button type="submit" disabled={!folderName.trim() || savingFolderName}>
                {savingFolderName ? <Loader2 className="animate-spin" /> : null}Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movingDrawing !== null}
        onOpenChange={(open) => { if (!open && !savingMove) setMovingDrawing(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move drawing</DialogTitle>
            <DialogDescription>Choose a folder for “{movingDrawing?.name}”.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {movingDrawing?.folderId && (
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                disabled={savingMove}
                onClick={() => { void handleMoveDrawing(null); }}
              >
                <FolderIcon />All drawings
              </Button>
            )}
            {folders
              .filter((folder) => folder.id !== (movingDrawing?.folderId ?? null))
              .map((folder) => (
                <Button
                  key={folder.id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={savingMove}
                  onClick={() => { void handleMoveDrawing(folder.id); }}
                >
                  <FolderIcon />{folder.name}
                </Button>
              ))}
            {folders.filter((folder) => folder.id !== (movingDrawing?.folderId ?? null)).length === 0 && !movingDrawing?.folderId && (
              <p className="py-4 text-center text-sm text-muted-foreground">There are no other folders to move this drawing to.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMovingDrawing(null)} disabled={savingMove}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

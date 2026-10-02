import { Excalidraw } from '@excalidraw/excalidraw';
import { Download, Loader2, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkspaceFile, SaveStatus } from '../lib/client';

const statusLabel: Record<SaveStatus, string> = {
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
};

type Props = {
  drawing: WorkspaceFile;
  scene: unknown;
  saveStatus: SaveStatus;
  dark: boolean;
  editorApiRef: React.MutableRefObject<any>;
  onClose: () => void;
  onSave: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
};

export function EditorView({
  drawing, scene, saveStatus, dark,
  editorApiRef, onClose, onSave, onRename, onDelete, onExport,
}: Props) {
  const saving = saveStatus === 'saving';

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close editor"><X /></Button>
        <Input
          defaultValue={drawing.name}
          onBlur={(e) => onRename(e.target.value)}
          className="max-w-xs border-0 text-base font-medium shadow-none"
        />
        <span className="ml-auto text-sm text-muted-foreground">{statusLabel[saveStatus]}</span>
        <Button size="lg" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}Save
        </Button>
        <Button size="lg" variant="outline" onClick={onExport}><Download />Export</Button>
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={saving} aria-label="Delete drawing"><Trash2 /></Button>
      </header>

      <div className="min-h-0 flex-1">
        <Excalidraw
          key={drawing.id}
          excalidrawAPI={(api) => { editorApiRef.current = api; }}
          initialData={scene as any}
          theme={dark ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
}

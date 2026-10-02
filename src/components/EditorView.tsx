import { Excalidraw } from '@excalidraw/excalidraw';
import { Download, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkspaceFile, SaveStatus } from '../lib/client';

const statusLabel: Record<SaveStatus, string> = {
  saving: 'Saving...',
  saved: 'Saved',
  offline: 'Saved locally, offline',
  error: 'Save failed',
};

type ConflictBannerProps = {
  onReload: () => void;
  onCopy: () => void;
};

function ConflictBanner({ onReload, onCopy }: ConflictBannerProps) {
  return (
    <div className="flex items-center gap-3 border-b bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <span>Cloud version changed. Your local scene is safely retained.</span>
      <Button size="sm" variant="outline" onClick={onReload}>Reload cloud</Button>
      <Button size="sm" onClick={onCopy}>Save as copy</Button>
    </div>
  );
}

type Props = {
  drawing: WorkspaceFile;
  scene: unknown;
  saveStatus: SaveStatus;
  dirty: boolean;
  hasConflict: boolean;
  dark: boolean;
  editorApiRef: React.MutableRefObject<any>;
  onClose: () => void;
  onSave: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onChange: () => void;
  onResolveConflict: (action: 'reload' | 'copy') => void;
};

export function EditorView({
  drawing, scene, saveStatus, dirty, hasConflict, dark,
  editorApiRef, onClose, onSave, onRename, onDelete, onExport, onChange, onResolveConflict,
}: Props) {
  const statusText = dirty && saveStatus === 'saved' ? 'Unsaved' : statusLabel[saveStatus];

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close editor"><X /></Button>
        <Input
          defaultValue={drawing.name}
          onBlur={(e) => onRename(e.target.value)}
          className="max-w-xs border-0 text-base font-medium shadow-none"
        />
        <span className="ml-auto text-sm text-muted-foreground">{statusText}</span>
        <Button size="sm" onClick={onSave}><Save />Save now</Button>
        <Button variant="outline" size="sm" onClick={onExport}><Download />Export</Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete drawing"><Trash2 /></Button>
      </header>

      {hasConflict && (
        <ConflictBanner
          onReload={() => onResolveConflict('reload')}
          onCopy={() => onResolveConflict('copy')}
        />
      )}

      <div className="min-h-0 flex-1">
        <Excalidraw
          key={drawing.id}
          excalidrawAPI={(api) => { editorApiRef.current = api; }}
          initialData={scene as any}
          theme={dark ? 'dark' : 'light'}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

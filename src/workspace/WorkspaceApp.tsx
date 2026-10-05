import { useEffect, useState } from 'react';
import { serializeAsJSON } from '@excalidraw/excalidraw';
import { Toaster, toast } from 'sonner';
import { useWorkspace } from '../hooks/useWorkspace';
import { useDrawingEditor } from '../hooks/useDrawingEditor';
import { WorkspaceView } from '../components/WorkspaceView';
import { EditorView } from '../components/EditorView';

export default function App() {
  const [dark, setDark] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const workspace = useWorkspace();
  const editor = useDrawingEditor(workspace.updateDrawing, workspace.removeDrawing);

  useEffect(() => {
    workspace.refresh().catch((e: Error) => toast.error(e.message));
  }, [workspace.refresh]);

  const handleExport = () => {
    if (!editor.active || !editor.api.current) return;
    const scene = JSON.parse(serializeAsJSON(
      editor.api.current.getSceneElements(),
      editor.api.current.getAppState(),
      editor.api.current.getFiles(),
      'local',
    ));
    const blob = new Blob([JSON.stringify(scene)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${editor.active.name}.excalidraw`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const scene = JSON.parse(await file.text());
      const name = file.name.replace(/\.excalidraw$/i, '') || 'Imported drawing';
      const drawing = await workspace.createDrawing(name, null, scene);
      if (drawing) editor.openDrawing(drawing);
    } catch {
      toast.error('The selected file is not valid Excalidraw JSON.');
    }
  };

  if (editor.active) {
    return (
      <main className={dark ? 'dark h-screen' : 'h-screen'}>
        <EditorView
          drawing={editor.active}
          scene={editor.scene}
          saveStatus={editor.saveStatus}
          dark={dark}
          editorApiRef={editor.api}
          onClose={editor.closeDrawing}
          onSave={editor.save}
          onRename={async (name) => {
            const updated = await workspace.renameDrawing(editor.active!, name);
            editor.setActive(updated);
          }}
          onDelete={editor.deleteActive}
          onExport={handleExport}
        />
        <Toaster />
      </main>
    );
  }

  return (
    <main className={dark ? 'dark min-h-screen' : 'min-h-screen'}>
      <WorkspaceView
        folders={workspace.folders}
        drawings={workspace.drawings}
        loading={workspace.loading}
        opening={editor.opening}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onOpenDrawing={editor.openDrawing}
        folderId={folderId}
        onFolderChange={setFolderId}
        onCreateDrawing={() => workspace.createDrawing('Untitled drawing', folderId)}
        onImportDrawing={handleImport}
        onCreateFolder={() => workspace.createFolder(folderId)}
        onDeleteFolder={(folder) => workspace.deleteFolder(folder, workspace.drawings)}
      />
      <Toaster />
    </main>
  );
}

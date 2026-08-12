import { useCallback, useEffect, useState } from 'react';
import { createProject } from './domain/defaults';
import type { ProjectRecord } from './domain/types';
import { EditorWorkspace } from './features/editor/EditorWorkspace';
import { ProjectLibrary } from './features/projects/ProjectLibrary';
import { deleteProject, duplicateProject, listProjects, saveProject } from './storage/database';

interface ActiveProject {
  id: string;
  initialCamera?: boolean;
  initialFiles?: File[];
}

export default function App() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [active, setActive] = useState<ActiveProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setError('Local projects could not be opened. Check that private browsing is disabled.');
    }
  }, []);

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  const startProject = async (options: Omit<ActiveProject, 'id'>) => {
    const project = createProject(`Scan ${projects.length + 1}`);
    try {
      await saveProject({ project, pages: [] });
      setActive({ id: project.id, ...options });
    } catch {
      setError('A local project could not be created. Browser storage may be unavailable.');
    }
  };

  if (active) {
    return (
      <EditorWorkspace
        key={active.id}
        projectId={active.id}
        initialCamera={active.initialCamera}
        initialFiles={active.initialFiles}
        onBack={async () => {
          setActive(null);
          await refreshProjects();
        }}
      />
    );
  }

  return (
    <>
      {error && <div className="global-alert" role="alert"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
      <ProjectLibrary
        projects={projects}
        onNewCamera={() => void startProject({ initialCamera: true })}
        onNewFiles={(files) => void startProject({ initialFiles: files })}
        onOpen={(id) => setActive({ id })}
        onDuplicate={async (id) => {
          try {
            await duplicateProject(id);
            await refreshProjects();
          } catch {
            setError('The project could not be duplicated.');
          }
        }}
        onDelete={async (id) => {
          const project = projects.find((item) => item.id === id);
          if (!window.confirm(`Delete “${project?.name ?? 'this project'}” from this device? This cannot be undone.`)) return;
          try {
            await deleteProject(id);
            await refreshProjects();
          } catch {
            setError('The project could not be deleted.');
          }
        }}
      />
    </>
  );
}

import { Camera, Copy, FilePlus2, Files, HardDrive, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProjectRecord } from '../../domain/types';
import { FileImportButton } from '../../components/FileImportButton';
import { IconButton } from '../../components/IconButton';

interface ProjectLibraryProps {
  projects: ProjectRecord[];
  onNewCamera: () => void;
  onNewFiles: (files: File[]) => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectLibrary({ projects, onNewCamera, onNewFiles, onOpen, onDuplicate, onDelete }: ProjectLibraryProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  return (
    <main className="library-page">
      <header className="brand-header">
        <div className="brand-mark"><Files size={22} /></div>
        <span>Clearfile</span>
        <div className="privacy-mark"><HardDrive size={15} /> On-device only</div>
      </header>

      <section className="capture-band" aria-labelledby="start-heading">
        <div>
          <p className="eyebrow">NEW DOCUMENT</p>
          <h1 id="start-heading">Create a clean, official PDF</h1>
          <p>Scan pages or import existing files. Nothing leaves this device.</p>
        </div>
        <div className="capture-actions">
          <button className="button primary" onClick={onNewCamera}><Camera size={19} /> Scan with camera</button>
          <FileImportButton onFiles={onNewFiles} />
        </div>
      </section>

      <section className="projects-section" aria-labelledby="projects-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LOCAL PROJECTS</p>
            <h2 id="projects-heading">Continue editing</h2>
          </div>
          <span>{projects.length} saved</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty-projects">
            <FilePlus2 size={26} />
            <div><strong>No local projects</strong><p>Your saved scans will appear here.</p></div>
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <article className="project-row" key={project.id}>
                <button className="project-open" onClick={() => onOpen(project.id)}>
                  <span className="project-icon"><Files size={21} /></span>
                  <span className="project-copy">
                    <strong>{project.name}</strong>
                    <span>Edited {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(project.updatedAt)}</span>
                  </span>
                </button>
                <div className="project-menu-wrap">
                  <IconButton label={`More options for ${project.name}`} onClick={() => setMenuId(menuId === project.id ? null : project.id)}>
                    <MoreVertical />
                  </IconButton>
                  {menuId === project.id && (
                    <div className="project-menu">
                      <button onClick={() => { onDuplicate(project.id); setMenuId(null); }}><Copy size={16} /> Duplicate</button>
                      <button className="danger" onClick={() => { onDelete(project.id); setMenuId(null); }}><Trash2 size={16} /> Delete</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

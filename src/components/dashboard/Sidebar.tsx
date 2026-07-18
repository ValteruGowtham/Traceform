import { PrTemplate } from '@/lib/templates';
import { tagClass, tagLabel } from './utils';

interface SidebarProps {
  repos: string[];
  activeRepo: string;
  selectedTemplate: PrTemplate;
  templates: PrTemplate[];
  runState: 'idle' | 'running' | 'done' | 'error';
  onSelectRepo: (repo: string) => void;
  onSelectTemplate: (template: PrTemplate) => void;
  onRunReview: () => void;
}

export function Sidebar({
  repos,
  activeRepo,
  selectedTemplate,
  templates,
  runState,
  onSelectRepo,
  onSelectTemplate,
  onRunReview,
}: SidebarProps) {
  return (
    <aside className="island island-sidebar">
      <div className="brand-header">
        <div className="brand-icon" style={{ fontSize: 22 }}>
          ⬡
        </div>
        <div className="brand-text">
          <h1>Traceform</h1>
          <span>Execution-Backed Review</span>
        </div>
      </div>

      <div className="section-title">Repositories</div>
      <div className="scroll-area" style={{ flex: 'none', paddingBottom: 0 }}>
        {repos.map((repo) => (
          <button
            key={repo}
            type="button"
            className={`list-item ${activeRepo === repo ? 'active' : ''}`}
            onClick={() => onSelectRepo(repo)}
            aria-label={`Select repository ${repo}`}
          >
            <div className="item-icon">📁</div>
            <div className="item-details">
              <div className="item-title">{repo.split('/')[1]}</div>
              <div className="item-subtitle">{repo.split('/')[0]}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="section-title">Test Scenarios</div>
      <div className="scroll-area">
        {templates.filter((template) => template.repo === activeRepo).map((template) => (
          <button
            key={template.id}
            type="button"
            className={`list-item ${selectedTemplate.id === template.id ? 'active' : ''}`}
            onClick={() => onSelectTemplate(template)}
            aria-label={`Select scenario ${template.title}`}
          >
            <div className="item-details">
              <div className="item-title">{template.title}</div>
              <div className="item-subtitle" style={{ marginBottom: 8 }}>
                {template.description}
              </div>
              <span className={`pill ${tagClass(template.tag)}`}>{tagLabel(template.tag)}</span>
            </div>
          </button>
        ))}
      </div>

      <button className="btn-action" onClick={onRunReview} disabled={runState === 'running'} aria-label="Analyze selected pull request">
        {runState === 'running' ? (
          <>
            <span className="spinner" /> Analyzing PR...
          </>
        ) : (
          <>▶ Analyze PR</>
        )}
      </button>
    </aside>
  );
}

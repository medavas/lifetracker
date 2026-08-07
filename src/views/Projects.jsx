import { useParams } from 'react-router-dom'
import ProjectList from './projects/ProjectList'
import ProjectDetail from './projects/ProjectDetail'

/**
 * One route tree serves both layouts. Desktop (>=900px, CSS): both panes
 * render side by side, mirroring Dashboard's existing two-column split.
 * Mobile: CSS shows only one at a time, driven by whether :projectId is
 * present in the URL. Selecting a project is always a real navigation, so
 * the same two components work unmodified at either width.
 */
export default function Projects() {
  const { projectId } = useParams()

  return (
    <div className="page" style={{ '--area-c1': 'var(--trim-b)' }}>
      <div className={`projects-shell ${projectId ? 'has-detail' : ''}`}>
        <div className="projects-list-pane"><ProjectList /></div>
        <div className="projects-detail-pane">
          {projectId ? <ProjectDetail /> : <div className="empty-note">Select a project.</div>}
        </div>
      </div>
    </div>
  )
}

import { useParams } from 'react-router-dom'
import AcademiaList from './academia/AcademiaList'
import AcademiaDetail from './academia/AcademiaDetail'
import { areaById } from '../data/areas'

/**
 * Same delinearized shell as Projects: one route tree, list and detail
 * panes driven purely by whether :itemId is in the URL (see Projects.jsx).
 * Desktop shows both side by side; mobile shows the detail pane as a
 * full-screen overlay that slides in from the right (see the
 * "Academia" block in App.css) instead of Projects' plain instant swap --
 * the notes textbox wants an immersive, distraction-free surface.
 */
export default function Academia() {
  const { itemId } = useParams()

  return (
    <div className="page" style={{ '--area-c1': `var(--trim-${areaById('academia').trim})` }}>
      <div className={`academia-shell ${itemId ? 'has-detail' : ''}`}>
        <div className="academia-list-pane"><AcademiaList /></div>
        <div className="academia-detail-pane" key={itemId}>
          {itemId ? <AcademiaDetail /> : <div className="empty-note">Select an entry.</div>}
        </div>
      </div>
    </div>
  )
}

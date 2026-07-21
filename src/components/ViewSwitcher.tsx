import { useStore } from '../store'
import RingView from './RingView'
import CloudView from './CloudView'
import LayerView from './LayerView'
import GraphView from './GraphView'
import GlobeView from './GlobeView'

export default function ViewSwitcher() {
  const view = useStore((s) => s.settings.view)
  switch (view) {
    case 'cloud': return <CloudView />
    case 'ebenen': return <LayerView />
    case 'graph': return <GraphView />
    case 'globus': return <GlobeView />
    default: return <RingView /> // ring + architektur
  }
}

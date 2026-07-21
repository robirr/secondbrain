import { useStore } from '../store'
import ViewSettingsPanel from './ViewSettingsPanel'
import InspectorPanel from './InspectorPanel'

export default function RightPanel() {
  const selected = useStore((s) => s.selected)
  return (
    <aside className="glass relative z-20 h-full w-[320px] shrink-0 border-y-0 border-r-0">
      {selected ? <InspectorPanel /> : <ViewSettingsPanel />}
    </aside>
  )
}

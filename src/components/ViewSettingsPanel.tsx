import { useState } from 'react'
import { Cloud, Globe, Disc3, Layers, Share2, Boxes, Save, RotateCcw, Camera, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CLUSTERS } from '../data/clusters'
import { useStore } from '../store'
import type { Settings } from '../store'

interface Preset { name: string; settings: Settings }
const PRESET_KEY = 'brain-presets'
const loadPresets = (): Preset[] => { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]') } catch { return [] } }
const savePresets = (p: Preset[]) => localStorage.setItem(PRESET_KEY, JSON.stringify(p))

function exportScreenshot(): string | null {
  const main = document.querySelector('main')
  if (!main) return 'Kein Bereich zum Export.'
  const dl = (url: string) => { const a = document.createElement('a'); a.href = url; a.download = 'second-brain.png'; a.click() }
  const svg = main.querySelector('svg')
  const canvas = main.querySelector('canvas')
  if (svg) {
    const xml = new XMLSerializer().serializeToString(svg)
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 1400; c.height = 1400
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, 1400, 1400)
      ctx.drawImage(img, 0, 0, 1400, 1400)
      c.toBlob((b) => b && dl(URL.createObjectURL(b)))
    }
    img.src = src
    return null
  }
  if (canvas) { try { dl(canvas.toDataURL('image/png')); return null } catch { return 'Globus-Export nicht möglich.' } }
  return 'Für diese Ansicht ist kein Screenshot verfügbar.'
}

const VIEWS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'architektur', label: 'Architektur', icon: Boxes },
  { key: 'ring', label: 'Ring', icon: Disc3 },
  { key: 'ebenen', label: 'Ebenen', icon: Layers },
  { key: 'globus', label: 'Globus', icon: Globe },
  { key: 'cloud', label: 'Cloud', icon: Cloud },
  { key: 'graph', label: 'Graph', icon: Share2 },
]

export default function ViewSettingsPanel() {
  const { settings, setSetting, applySettings, nodes, edges, dataSource } = useStore()
  const activeProjects = nodes.filter((n) => n.type === 'project' && n.status === 'active').length
  const [presets, setPresets] = useState<Preset[]>(loadPresets)
  const [msg, setMsg] = useState<string | null>(null)
  const addPreset = () => { const p = [...presets, { name: `${settings.view} · ${settings.detail}%`, settings }]; setPresets(p); savePresets(p); setMsg('Preset gespeichert.') }
  const removePreset = (i: number) => { const p = presets.filter((_, x) => x !== i); setPresets(p); savePresets(p) }
  const shot = () => setMsg(exportScreenshot() ?? 'Screenshot exportiert.')

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-4">
        <div className="text-[14px] font-semibold tracking-tight">Ansicht konfigurieren</div>
        <div className="eyebrow mt-1">Darstellung &amp; Filter</div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Group title="Ansicht">
          <div className="grid grid-cols-3 gap-2">
            {VIEWS.map(({ key, label, icon: Icon }) => {
              const on = settings.view === key
              return (
                <button key={key} onClick={() => setSetting('view', key)}
                  className={['flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] transition-colors',
                    on ? 'border-[rgba(139,124,246,0.5)] bg-[rgba(139,124,246,0.12)] text-ink glow-violet' : 'border-line text-muted hover:bg-white/[0.04]'].join(' ')}>
                  <Icon size={16} className={on ? 'text-c-wissen' : ''} />
                  {label}
                </button>
              )
            })}
          </div>
          {settings.view !== 'ring' && (
            <p className="mt-2 text-[11px] text-faint">Nur „Ring" ist in dieser Version aktiv — weitere Ansichten folgen.</p>
          )}
        </Group>

        <Group title="Darstellung">
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="text-muted">Detailgrad</span>
              <span className="font-mono text-ink">{settings.detail}%</span>
            </div>
            <input type="range" min={0} max={100} value={settings.detail}
              onChange={(e) => setSetting('detail', +e.target.value)}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#8b7cf6]" />
            <p className="mt-1 text-[10px] text-faint">Ab 60 % zeigen Cluster ihre Notiz-Anzahl.</p>
          </div>
          <div className="mb-3">
            <div className="mb-1.5 text-[12px] text-muted">Angezeigte Ebenen</div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setSetting('layers', n)}
                  className={['h-8 flex-1 rounded-lg border font-mono text-[12px] transition-colors',
                    settings.layers >= n ? 'border-[rgba(139,124,246,0.5)] bg-[rgba(139,124,246,0.14)] text-ink' : 'border-line text-faint hover:bg-white/[0.04]'].join(' ')}>{n}</button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-faint">1 Orchestrator · 2 +Kern · 3 +Wissen · 4 +Aktive Welt</p>
          </div>
          <div className="space-y-1">
            <Toggle k="animation" label="Animation" />
            <Toggle k="labels" label="Labels" />
            <Toggle k="verbindungen" label="Verbindungen (dauerhaft)" />
            <Toggle k="extern" label="Externe Systeme" />
          </div>
        </Group>

        <Group title="Filter">
          <div className="flex flex-wrap gap-1.5">
            {([['alle', 'Alle'], ['wissen', 'Wissen'], ['projekte', 'Projekte'], ['extern', 'Externe'], ['aktiv', 'Aktive Projekte']] as const).map(([key, label]) => {
              const on = settings.filter === key
              return (
                <button key={key} onClick={() => setSetting('filter', key)}
                  className={['rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors',
                    on ? 'border-[rgba(139,124,246,0.5)] bg-[rgba(139,124,246,0.14)] text-ink' : 'border-line text-muted hover:bg-white/[0.04]'].join(' ')}>
                  {label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-faint">Wirkt in Ring & Graph (Orchestrator bleibt sichtbar).</p>
        </Group>

        <Group title="Farbschema">
          <div className="flex flex-wrap gap-2">
            {CLUSTERS.map((c) => (
              <span key={c.key} title={c.label} className="h-5 w-5 rounded-full ring-1 ring-white/10"
                style={{ background: c.color, boxShadow: `0 0 10px -2px ${c.color}` }} />
            ))}
          </div>
        </Group>

        <Group title="Informationen">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Knoten" value={String(nodes.length)} />
            <Stat label="Verbind." value={String(edges.length)} />
            <Stat label="Aktiv" value={String(activeProjects)} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
            <span>Datenquelle</span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dataSource === 'live' ? '#57d07f' : '#8798b5' }} />
              {dataSource === 'live' ? 'Live (graph.json)' : 'Demo'}
            </span>
          </div>
        </Group>

        {presets.length > 0 && (
          <Group title="Presets">
            <div className="space-y-1">
              {presets.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5">
                  <button onClick={() => applySettings(p.settings)} className="flex-1 truncate text-left text-[12px] text-muted hover:text-ink">{p.name}</button>
                  <button onClick={() => removePreset(i)} title="Löschen" className="text-faint hover:text-ink"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </Group>
        )}
      </div>

      <div className="border-t border-line p-4">
        {msg && <div className="mb-2 text-center text-[11px] text-faint">{msg}</div>}
        <div className="flex gap-2">
          <button onClick={addPreset}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[rgba(139,124,246,0.16)] px-3 py-2 text-[12.5px] text-ink transition-colors hover:bg-[rgba(139,124,246,0.24)] glow-violet">
            <Save size={14} /> Preset speichern
          </button>
          <button title="Screenshot exportieren" onClick={shot}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-white/[0.05]">
            <Camera size={14} />
          </button>
          <button title="Zurücksetzen" onClick={() => resetSettings(setSetting)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-white/[0.05]">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function resetSettings(setSetting: ReturnType<typeof useStore.getState>['setSetting']) {
  setSetting('detail', 75); setSetting('layers', 4); setSetting('animation', true)
  setSetting('labels', true); setSetting('verbindungen', false); setSetting('extern', true)
  setSetting('filter', 'alle')
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><div className="eyebrow mb-2.5">{title}</div>{children}</section>
}

function Toggle({ k, label }: { k: keyof Settings; label: string }) {
  const { settings, setSetting } = useStore()
  const on = settings[k] as boolean
  return (
    <button onClick={() => setSetting(k, !on as never)}
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[12.5px] text-muted hover:text-ink">
      <span>{label}</span>
      <span className={['relative h-[18px] w-8 rounded-full transition-colors', on ? 'bg-[rgba(139,124,246,0.6)]' : 'bg-white/10'].join(' ')}>
        <span className={['absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]'].join(' ')} />
      </span>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] px-2 py-2 text-center">
      <div className="font-mono text-[15px] text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] text-faint">{label}</div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Cloud, Globe, Disc3, Layers, Share2, Save, RotateCcw, Camera, Trash2, Unlink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useVisibleNotes } from '../display'
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
  { key: 'ring', label: 'Ring', icon: Disc3 },
  { key: 'ebenen', label: 'Ebenen', icon: Layers },
  { key: 'globus', label: 'Globus', icon: Globe },
  { key: 'cloud', label: 'Cloud', icon: Cloud },
  { key: 'graph', label: 'Graph', icon: Share2 },
]

export default function ViewSettingsPanel() {
  const { settings, setSetting, applySettings, nodes, rawNotes, noteEdges, dataSource } = useStore()
  const visible = useVisibleNotes()
  const total = rawNotes.length
  const shown = visible.length

  // Bereiche aus der Landkarte — mit sichtbarer und tatsächlicher Anzahl
  const clusters = useMemo(() => nodes
    .filter((n) => n.type === 'knowledge' && n.meta?.Ordner)
    .map((n) => {
      const folder = n.meta!.Ordner as string
      return {
        folder, name: n.name, color: n.color,
        total: rawNotes.filter((r) => r.cluster === folder).length,
        shown: visible.filter((r) => r.cluster === folder).length,
      }
    })
    .filter((c) => c.total > 0), [nodes, rawNotes, visible])

  const sources = useMemo(() => {
    const by = new Map<string, number>()
    for (const n of rawNotes) by.set(n.source || 'ohne Angabe', (by.get(n.source || 'ohne Angabe') ?? 0) + 1)
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }, [rawNotes])

  const linkedCount = useMemo(() => {
    const s = new Set<string>()
    for (const e of noteEdges) { s.add(e.source); s.add(e.target) }
    return rawNotes.filter((r) => s.has(r.id)).length
  }, [noteEdges, rawNotes])
  const orphanCount = total - linkedCount

  // Bereich an-/abwählen: aus „alle" wird beim ersten Klick „alle ausser diesem"
  const toggleCluster = (folder: string) => {
    const all = clusters.map((c) => c.folder)
    const cur = settings.clusters ?? all
    const next = cur.includes(folder) ? cur.filter((f) => f !== folder) : [...cur, folder]
    setSetting('clusters', next.length === all.length ? null : next) // alle an = kein Filter
  }

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
            <p className="mt-1 text-[10px] text-faint">Dichte der Sterne in der Wolken-Ansicht.</p>
          </div>
          <div className="space-y-1">
            <Toggle k="animation" label="Animation" />
            <Toggle k="labels" label="Beschriftungen" />
            <Toggle k="verbindungen" label="Verweise dauerhaft zeigen" />
          </div>
        </Group>

        <Group title="Bereiche">
          <div className="space-y-1">
            {clusters.map((c) => {
              const on = !settings.clusters || settings.clusters.includes(c.folder)
              return (
                <button key={c.folder} onClick={() => toggleCluster(c.folder)}
                  title={on ? `„${c.name}" ausblenden` : `„${c.name}" einblenden`}
                  className={['flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors',
                    on ? 'border-line bg-white/[0.03] text-ink' : 'border-transparent text-faint hover:bg-white/[0.02]'].join(' ')}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: c.color, opacity: on ? 1 : 0.3, boxShadow: on ? `0 0 8px -1px ${c.color}` : undefined }} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-faint">{c.shown === c.total ? c.total : `${c.shown}/${c.total}`}</span>
                </button>
              )
            })}
          </div>
          {settings.clusters && (
            <button onClick={() => setSetting('clusters', null)}
              className="mt-1.5 text-[11px] text-c-wissen hover:underline">alle Bereiche zeigen</button>
          )}
        </Group>

        <Group title="Herkunft">
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s) => {
              const on = settings.source === s.name
              return (
                <button key={s.name} onClick={() => setSetting('source', on ? null : s.name)}
                  title={`nur Notizen aus „${s.name}"`}
                  className={['rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors',
                    on ? 'border-[rgba(139,124,246,0.5)] bg-[rgba(139,124,246,0.14)] text-ink' : 'border-line text-muted hover:bg-white/[0.04]'].join(' ')}>
                  {s.name} <span className="font-mono text-[10px] text-faint">{s.count}</span>
                </button>
              )
            })}
          </div>
        </Group>

        <Group title="Verweise">
          <button onClick={() => setSetting('orphans', !settings.orphans)}
            title="Notizen, auf die nichts verweist und die selbst nichts verlinken"
            className={['flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-[12px] transition-colors',
              settings.orphans ? 'border-[rgba(139,124,246,0.5)] bg-[rgba(139,124,246,0.14)] text-ink' : 'border-line text-muted hover:bg-white/[0.04]'].join(' ')}>
            <span className="inline-flex items-center gap-2"><Unlink size={13} /> nur ohne Verweis</span>
            <span className="font-mono text-[11px] text-faint">{orphanCount}</span>
          </button>
          <p className="mt-1.5 text-[10px] text-faint">{linkedCount} von {total} Notizen sind verknüpft.</p>
        </Group>

        <Group title="Bestand">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="sichtbar" value={String(shown)} />
            <Stat label="Notizen" value={String(total)} />
            <Stat label="Verweise" value={String(noteEdges.length)} />
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
  setSetting('detail', 75); setSetting('animation', true)
  setSetting('labels', true); setSetting('verbindungen', false)
  setSetting('clusters', null); setSetting('source', null); setSetting('orphans', false)
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

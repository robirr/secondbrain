// Ansicht „Verbindungen" — nüchterne Liste dessen, was das Brain speist und was daraus
// gebaut wird. Alles darin ist gemessen (integrations.json aus dem Indexlauf), nichts behauptet.
// Nur Lesen: die Seite zeigt Befehle an, führt aber keine aus.
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownToLine, ArrowUpFromLine, Boxes, Check, Copy, KeyRound, Wrench, FileStack, TriangleAlert,
  PlugZap, ListOrdered,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useIntegrations } from '../data/integrations'
import type { IntAccess, IntRule, IntSource, SourceState, TokenState } from '../data/integrations'

const TOKEN_COLOR: Record<TokenState, string> = {
  gesetzt: 'var(--color-c-beruf)',
  fehlt: 'var(--color-c-gesundheit)',
  unbekannt: 'var(--color-faint)',
}

const STATE_COLOR: Record<SourceState, string> = {
  liefert: 'var(--color-c-beruf)',
  bereit: 'var(--color-c-projekte)',
  blockiert: 'var(--color-c-gesundheit)',   // eingerichtet, aber nicht benutzbar
  'übersprungen': 'var(--color-faint)',   // Entscheidung, kein Mangel — daher kein Warnton
  'nicht gebaut': 'var(--color-c-finanzen)',
  'kein Token': 'var(--color-c-gesundheit)',
}

const SYNC_LABEL: Record<string, string> = {
  auto: 'automatisch (sync.mjs)',
  manuell: 'nur von Hand',
  keiner: 'kein Abgleich',
  push: 'Push in die Inbox',
}

// Kopieren zuerst über die alte, SYNCHRONE Textflächen-Methode: navigator.clipboard gibt es
// unter http:// (unsicherer Kontext) gar nicht und scheitert ohne Fensterfokus — dann würde
// die Rückmeldung „kopiert" lügen. Die moderne Variante ist nur der Nachfall.
function copyText(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('style', 'position:fixed;top:0;left:0;opacity:0')
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (ok) return true
  } catch { /* Nachfall unten */ }
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => { /* nichts zu tun */ })
      return true
    }
  } catch { /* nicht möglich */ }
  return false
}

function Cmd({ text, kind = 'shell' }: { text: string; kind?: 'shell' | 'url' }) {
  const [msg, setMsg] = useState<string | null>(null)
  const run = () => {
    setMsg(copyText(text) ? 'kopiert' : 'bitte markieren')
    setTimeout(() => setMsg(null), 1400)
  }
  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-line bg-black/25 px-3 py-2">
      <span className="shrink-0 font-mono text-[11.5px] text-faint">{kind === 'url' ? '↗' : '$'}</span>
      <code className="select-all truncate font-mono text-[11.5px] text-muted">{text}</code>
      <button onClick={run}
        className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider text-faint transition-colors hover:text-ink">
        {msg ? <Check size={12} /> : <Copy size={12} />}{msg ?? 'kopieren'}
      </button>
    </div>
  )
}

function Fact({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{k}</div>
      <div className={`truncate text-[12.5px] text-muted ${mono ? 'font-mono text-[11.5px]' : ''}`} title={v}>{v}</div>
    </div>
  )
}

function Section({ icon: Icon, title, hint, children }: {
  icon: LucideIcon; title: string; hint: string; children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2.5">
        <Icon size={15} className="translate-y-[2px] text-c-wissen" strokeWidth={1.8} />
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink">{title}</h2>
        <span className="text-[12px] text-faint">{hint}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function SourceRow({ s, total }: { s: IntSource; total: number }) {
  const color = STATE_COLOR[s.state] ?? 'var(--color-faint)'
  const share = total > 0 ? (s.notes / total) * 100 : 0
  const Dir = s.mode === 'push' ? ArrowUpFromLine : ArrowDownToLine
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-4 pb-3.5 pt-3">
      <div className="flex items-baseline gap-3">
        <span className="h-2 w-2 shrink-0 -translate-y-[2px] rounded-full"
          style={{ background: color, boxShadow: `0 0 8px -1px ${color}` }} />
        <span className="text-[14.5px] font-medium text-ink">{s.label}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-[1px] text-[10.5px] uppercase tracking-wider text-faint">
          <Dir size={10} />{s.mode === 'push' ? 'Push' : 'Pull'}
        </span>
        <span className="text-[12px]" style={{ color }}>{s.state}</span>
        <div className="ml-auto shrink-0 text-right">
          <div className="font-mono text-[17px] leading-none text-ink">{s.notes}</div>
          <div className="eyebrow mt-1">von {total} Notizen</div>
        </div>
      </div>

      {/* Anteil am Bestand — macht ein Übergewicht sofort sichtbar */}
      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-6 gap-y-2.5">
        <Fact k="Adresse" v={s.base_url} mono />
        <Fact k="Weg" v={s.transport} />
        <Fact k="Umfang" v={s.mode === 'push' ? `${s.scope} → ${s.target ?? 'Inbox'}` : s.scope} />
        <Fact k="Format" v={s.format} />
        <Fact k="Abgleich" v={SYNC_LABEL[s.sync] ?? s.sync} />
        <Fact k="Neueste Notiz" v={s.newest ?? '—'} />
        <Fact k="Token" v={`${s.auth_env} · ${s.token_state}`} mono />
        <Fact k="Bereits geholt" v={s.tracked_ids ? `${s.tracked_ids} Kennungen vermerkt` : '—'} />
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{s.note}</p>
      {/* Ein eingerichteter, aber nicht benutzbarer Kanal muss das sagen — sonst liest sich
          „bereit" wie eine Zusage. Der Befehl bleibt daneben stehen: er ist der Weg zurück. */}
      {s.blocked && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-[12px]"
          style={{ borderColor: 'var(--color-c-gesundheit)', color: 'var(--color-c-gesundheit)' }}>
          <TriangleAlert size={13} className="mt-[2px] shrink-0" />
          <span>{s.blocked}</span>
        </div>
      )}
      {/* Warnen nur, wo wirklich etwas fehlt: bei einer bewussten Entscheidung oder einem
          benannten Hindernis steht der Grund schon darüber. */}
      {s.command
        ? <Cmd text={s.command} />
        : !s.skipped && !s.blocked && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[12px] text-faint">
            <TriangleAlert size={13} /> Kein Konnektor vorhanden — diese Quelle kann derzeit nicht geholt werden.
          </div>
        )}
    </div>
  )
}

// Die Oberfläche kennt ihre eigene Adresse — der Indexer kann sie nicht kennen.
function realAddress(address: string | null): string | null {
  if (address === 'origin') return window.location.origin
  if (address === 'origin+/qmd/mcp') return window.location.origin + '/qmd/mcp'
  return address
}

function AccessRow({ a }: { a: IntAccess }) {
  const addr = realAddress(a.address)
  const isUrl = Boolean(addr && /^https?:/.test(addr) && !addr.includes('<'))
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[14px] font-medium text-ink">{a.name}</span>
        {addr && !isUrl && (
          <code className="truncate font-mono text-[11.5px] text-muted" title={addr}>{addr}</code>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{a.what}</p>
      <div className="mt-1.5 text-[11.5px] text-faint">Zugangsschutz: {a.auth}</div>
      {addr && isUrl && <Cmd text={addr} kind="url" />}
      {a.command && <Cmd text={a.command} />}
    </div>
  )
}

function RuleRow({ r }: { r: IntRule }) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
      <span className="mt-[2px] grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line font-mono text-[11px] text-c-wissen">
        {r.n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[13.5px] font-medium text-ink">{r.title}</span>
          {r.fact && <span className="ml-auto shrink-0 font-mono text-[11px] text-faint">{r.fact}</span>}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{r.text}</p>
        {r.command && <Cmd text={r.command} />}
      </div>
    </div>
  )
}

export default function ConnectionsPage() {
  const load = useIntegrations()

  if (load.state === 'laden') {
    return <div className="grid h-full place-items-center text-[13px] text-faint">Bestandsaufnahme wird gelesen …</div>
  }

  if (load.state === 'fehlt') {
    return (
      <div className="grid h-full place-items-center px-8">
        <div className="glass max-w-[560px] rounded-2xl p-6">
          <div className="eyebrow mb-2">Verbindungen</div>
          <h2 className="mb-2 text-[16px] font-semibold text-ink">Noch keine Bestandsaufnahme</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            <code className="font-mono text-[12px] text-ink">data/integrations.json</code> fehlt. Sie entsteht beim
            Indexlauf im Vault — zusammen mit <code className="font-mono text-[12px]">INDEX.md</code> und{' '}
            <code className="font-mono text-[12px]">graph.json</code>:
          </p>
          <Cmd text="node _system/scripts/build-index.mjs" />
          <p className="mt-3 text-[12px] text-faint">Danach diese Seite neu laden.</p>
        </div>
      </div>
    )
  }

  const d = load.data
  const total = d.vault.notes

  return (
    <div className="h-full overflow-y-auto px-8 pb-12 pt-5">
      <div className="mx-auto max-w-[1060px] space-y-9">
        {/* Stand — damit klar ist, wie alt die Zahlen sind */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
          <span className="text-[12.5px] text-muted">
            Gemessen beim Indexlauf am <span className="font-mono text-ink">{d.generatedAt}</span>
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[12px] text-faint">
            <span><span className="text-ink">{d.vault.notes}</span> Notizen</span>
            <span><span className="text-ink">{d.vault.edges}</span> Verweise</span>
            <span><span className="text-ink">{d.vault.clusters}</span> Bereiche</span>
            <span><span className="text-ink">{d.vault.inbox}</span> in der Inbox</span>
          </div>
        </div>

        <Section icon={PlugZap} title="Zugang" hint="wie du dich mit dem Brain verbindest">
          {d.access.map((a) => <AccessRow key={a.key} a={a} />)}
        </Section>

        <Section icon={Boxes} title="Quellen" hint="woher die Notizen kommen">
          {d.sources.map((s) => <SourceRow key={s.key} s={s} total={total} />)}
          {d.foreign.map((f) => (
            <div key={f.name} className="flex items-baseline gap-3 rounded-xl border border-dashed border-line px-4 py-3">
              <span className="h-2 w-2 shrink-0 -translate-y-[2px] rounded-full bg-faint/60" />
              <span className="text-[13.5px] text-muted">{f.name}</span>
              <span className="text-[12px] text-faint">keine Quelle deklariert</span>
              <div className="ml-auto shrink-0 text-right">
                <div className="font-mono text-[15px] leading-none text-muted">{f.notes}</div>
                <div className="eyebrow mt-1">Notizen</div>
              </div>
            </div>
          ))}
        </Section>

        <Section icon={ListOrdered} title="Regeln" hint="was beim Ablegen und Importieren gilt">
          {d.rules.map((r) => <RuleRow key={r.n} r={r} />)}
        </Section>

        <Section icon={FileStack} title="Abgeleitet" hint="aus den Notizen gebaut — jederzeit neu baubar">
          {d.derived.map((x) => (
            <div key={x.name} className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[13px] text-ink">{x.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[11.5px] text-faint">{x.changed ?? 'kein Zeitstempel'}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted">{x.description}</p>
              <Cmd text={x.command} />
            </div>
          ))}
        </Section>

        <Section icon={Wrench} title="Werkzeuge" hint={`Skripte in ${d.toolsFrom} — Beschreibung und Aufruf aus dem Skript selbst`}>
          {d.tools.map((t) => (
            <div key={t.file} className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="truncate font-mono text-[12.5px] text-ink">{t.file}</span>
                {t.library && (
                  <span className="shrink-0 rounded-md border border-line px-1.5 py-[1px] text-[10.5px] uppercase tracking-wider text-faint">
                    Bibliothek
                  </span>
                )}
                <span className="ml-auto shrink-0 font-mono text-[11.5px] text-faint">{t.changed ?? ''}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted">{t.description ?? 'ohne Kopfkommentar'}</p>
              {t.command && <Cmd text={t.command} />}
            </div>
          ))}
        </Section>

        <Section icon={KeyRound} title="Geheimnisse" hint={`Namen aus ${d.secretsFile} — die Werte stehen nur dort`}>
          <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3.5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-6 gap-y-2.5">
              {d.secrets.map((s) => (
                <div key={s.name} className="flex items-baseline gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 -translate-y-[2px] rounded-full"
                    style={{ background: TOKEN_COLOR[s.state] }} />
                  <span className="truncate font-mono text-[12px] text-muted">{s.name}</span>
                  <span className="ml-auto shrink-0 text-[11.5px]" style={{ color: TOKEN_COLOR[s.state] }}>
                    {s.state}
                  </span>
                  <span className="shrink-0 text-[11px] text-faint">{s.used_by ?? ''}</span>
                </div>
              ))}
            </div>
            {d.config.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line pt-3 font-mono text-[11.5px] text-faint">
                {d.config.map((c) => <span key={c.name}>{c.name} = <span className="text-muted">{c.value}</span></span>)}
              </div>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              {d.envFound
                ? 'Diese Ansicht kennt nur Namen und den Zustand — nie einen Wert. '
                : 'In diesem Vault liegt keine solche Datei, darum „unbekannt": von hier aus ist der Zustand nicht feststellbar. Die Tokens liegen auf dem Rechner, der die Konnektoren ausführt. '}
              <code className="mx-1 font-mono text-[11.5px]">{d.secretsFile}</code>
              wird über HTTP nie ausgeliefert.
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}

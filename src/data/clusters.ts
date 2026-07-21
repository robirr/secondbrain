export interface Cluster {
  key: string
  label: string
  color: string
}

// Konsistente Cluster-/Systemfarben (siehe D1-Brief).
export const CLUSTERS: Cluster[] = [
  { key: 'wissen', label: 'Wissen & Lernen', color: '#8b7cf6' },
  { key: 'projekte', label: 'Projekte', color: '#4c8dff' },
  { key: 'beruf', label: 'Beruf & Karriere', color: '#2dd4bf' },
  { key: 'finanzen', label: 'Finanzen', color: '#f6c344' },
  { key: 'gesundheit', label: 'Gesundheit', color: '#ff7a70' },
  { key: 'beziehungen', label: 'Beziehungen', color: '#e879c9' },
  { key: 'kreativitaet', label: 'Kreativität', color: '#ff9d4d' },
  { key: 'spiritualitaet', label: 'Spiritualität', color: '#7c83ff' },
  { key: 'reisen', label: 'Reisen', color: '#57d07f' },
  { key: 'sonstiges', label: 'Sonstiges', color: '#8798b5' },
]

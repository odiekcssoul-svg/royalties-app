import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatNumber, formatDate } from '../lib/utils'
import {
  ArrowLeft, Download, Loader2, DollarSign, TrendingUp, Globe,
  Music, Star, Radio, Users, ChevronDown, FileSpreadsheet, FileText as FilePdf, FileType2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { RoyaltyRecord, Report } from '../types/database'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316', '#84cc16', '#14b8a6']

type FilterKey = 'all' | string

// ============================================================
// Aggregate helper
// ============================================================
function aggregate(
  rows: RoyaltyRecord[],
  field: keyof RoyaltyRecord
): Array<{ name: string; earnings: number; streams: number }> {
  const map: Record<string, { earnings: number; streams: number }> = {}
  rows.forEach(r => {
    const key = String(r[field] || 'Unknown')
    if (!map[key]) map[key] = { earnings: 0, streams: 0 }
    map[key].earnings += r.earnings_usd
    map[key].streams  += r.quantity
  })
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.earnings - a.earnings)
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  // Filters
  const [artistFilter, setArtistFilter]     = useState<FilterKey>('all')
  const [platformFilter, setPlatformFilter] = useState<FilterKey>('all')
  const [songFilter, setSongFilter]         = useState<FilterKey>('all')
  const [countryFilter, setCountryFilter]   = useState<FilterKey>('all')

  // Artist view mode
  const [artistView, setArtistView] = useState<'global' | 'individual'>('global')
  const [showExportMenu, setShowExportMenu] = useState(false)

  const { data: report } = useQuery<Report>({
    queryKey: ['report', id],
    queryFn: async () => {
      const { data, error } = await db.from('reports').select('*').eq('id', id!).eq('user_id', user!.id).single()
      if (error) throw error
      return data as Report
    },
    enabled: !!id && !!user,
  })

  const { data: records, isLoading } = useQuery<RoyaltyRecord[]>({
    queryKey: ['royalty-records', id],
    queryFn: async () => {
      const { data, error } = await db
        .from('royalty_records')
        .select('*')
        .eq('report_id', id!)
        .eq('user_id', user!.id)
      if (error) throw error
      return data as RoyaltyRecord[]
    },
    enabled: !!id && !!user,
  })

  // All unique values for filter selectors
  const artists   = useMemo(() => [...new Set((records ?? []).map(r => r.artist_name))].sort(), [records])
  const platforms = useMemo(() => [...new Set((records ?? []).map(r => r.store))].sort(), [records])
  const songs     = useMemo(() => [...new Set((records ?? []).map(r => r.song_title))].sort(), [records])
  const countries = useMemo(() => [...new Set((records ?? []).map(r => r.country))].sort(), [records])

  // Artist earnings breakdown (for sidebar)
  const artistBreakdown = useMemo(() => aggregate(records ?? [], 'artist_name'), [records])
  const totalAll = useMemo(() => (records ?? []).reduce((a, r) => a + r.earnings_usd, 0), [records])

  // Apply all filters
  const filtered = useMemo(() => (records ?? []).filter(r =>
    (artistFilter   === 'all' || r.artist_name === artistFilter) &&
    (platformFilter === 'all' || r.store === platformFilter) &&
    (songFilter     === 'all' || r.song_title === songFilter) &&
    (countryFilter  === 'all' || r.country === countryFilter)
  ), [records, artistFilter, platformFilter, songFilter, countryFilter])

  const totalEarnings = useMemo(() => filtered.reduce((a, r) => a + r.earnings_usd, 0), [filtered])
  const totalStreams   = useMemo(() => filtered.reduce((a, r) => a + r.quantity, 0), [filtered])

  // Aggregations on filtered data
  const byPlatform = useMemo(() => aggregate(filtered, 'store'), [filtered])
  const byCountry  = useMemo(() => aggregate(filtered, 'country'), [filtered])
  const bySong     = useMemo(() => aggregate(filtered, 'song_title'), [filtered])
  const byAlbum    = useMemo(() => aggregate(filtered, 'album_name'), [filtered])
  const byArtist   = useMemo(() => aggregate(filtered, 'artist_name'), [filtered])

  const byMonth = useMemo(() => Object.entries(
    filtered.reduce<Record<string, number>>((acc, r) => {
      const m = (r.sale_period ?? '').slice(0, 7) || 'Unknown'
      acc[m] = (acc[m] ?? 0) + r.earnings_usd
      return acc
    }, {})
  ).map(([month, earnings]) => ({ month, earnings }))
   .sort((a, b) => a.month.localeCompare(b.month)), [filtered])

  const topPlatform = byPlatform[0]?.name ?? '—'
  const topCountry  = byCountry[0]?.name  ?? '—'
  const topSong     = bySong[0]?.name     ?? '—'

  const multipleArtists = artists.length > 1

  // ============================================================
  // Export functions
  // ============================================================
  const exportExcel = (rows: RoyaltyRecord[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Período: r.sale_period, Artista: r.artist_name, Plataforma: r.store,
      País: r.country, Álbum: r.album_name, Canción: r.song_title,
      Streams: r.quantity, 'Ingresos USD': r.earnings_usd,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Regalías')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  const exportCsv = (rows: RoyaltyRecord[], filename: string) => {
    const headers = ['Período','Artista','Plataforma','País','Álbum','Canción','Streams','Ingresos USD']
    const csvRows = rows.map(r =>
      [r.sale_period, r.artist_name, r.store, r.country, r.album_name, r.song_title, r.quantity, r.earnings_usd]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = (rows: RoyaltyRecord[], filename: string, artistName?: string) => {
    const doc = new jsPDF()
    const total = rows.reduce((a, r) => a + r.earnings_usd, 0)
    const streams = rows.reduce((a, r) => a + r.quantity, 0)

    // Header
    doc.setFillColor(99, 102, 241)
    doc.rect(0, 0, 220, 40, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Royalties', 14, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Music Analytics Platform', 14, 26)
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 14, 33)

    // Artist / title
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(artistName ? `Reporte: ${artistName}` : 'Reporte de Regalías', 14, 52)

    // Executive summary
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen ejecutivo', 14, 65)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const byPlat = aggregate(rows, 'store')
    const topSongPdf = aggregate(rows, 'song_title')[0]?.name ?? '—'
    const topCtry = aggregate(rows, 'country')[0]?.name ?? '—'
    const summary = [
      ['Ingresos totales', formatCurrency(total)],
      ['Total streams', formatNumber(streams)],
      ['Top plataforma', byPlat[0]?.name ?? '—'],
      ['Top canción', topSongPdf],
      ['Top país', topCtry],
      ['Registros', rows.length.toString()],
    ]
    autoTable(doc, {
      startY: 70,
      body: summary,
      styles: { fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 80 } },
      theme: 'plain',
    })

    const afterSummary = (doc as any).lastAutoTable.finalY + 10

    // Top songs
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Top canciones', 14, afterSummary)
    autoTable(doc, {
      startY: afterSummary + 4,
      head: [['Canción', 'Streams', 'Ingresos']],
      body: aggregate(rows, 'song_title').slice(0, 10).map(s => [s.name, formatNumber(s.streams), formatCurrency(s.earnings)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    })

    const afterSongs = (doc as any).lastAutoTable.finalY + 10

    // Top platforms
    doc.setFont('helvetica', 'bold')
    doc.text('Por plataforma', 14, afterSongs)
    autoTable(doc, {
      startY: afterSongs + 4,
      head: [['Plataforma', 'Streams', 'Ingresos']],
      body: byPlat.slice(0, 8).map(p => [p.name, formatNumber(p.streams), formatCurrency(p.earnings)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    })

    const afterPlat = (doc as any).lastAutoTable.finalY + 10

    // Detail table
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Detalle de regalías', 14, 20)
    autoTable(doc, {
      startY: 26,
      head: [['Período', 'Artista', 'Plataforma', 'País', 'Canción', 'Streams', 'USD']],
      body: rows.slice(0, 1000).map(r => [
        r.sale_period, r.artist_name, r.store, r.country, r.song_title,
        formatNumber(r.quantity), formatCurrency(r.earnings_usd)
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [99, 102, 241] },
    })

    doc.save(`${filename}.pdf`)
  }

  const handleExport = (format: 'excel' | 'csv' | 'pdf', scope: 'filtered' | 'artist' | 'all') => {
    setShowExportMenu(false)
    const rows = scope === 'all' ? (records ?? []) : filtered
    const artistLabel = artistFilter !== 'all' ? artistFilter : 'todos'
    const base = `royalties-${artistLabel}-${id?.slice(0, 8)}`

    if (format === 'excel') exportExcel(rows, base)
    else if (format === 'csv') exportCsv(rows, base)
    else exportPdf(rows, base, artistFilter !== 'all' ? artistFilter : undefined)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  )

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-6">
        <Link to="/reports" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-text-primary truncate">{report?.file_name}</h1>
          <p className="text-text-muted text-sm">
            {report ? formatDate(report.created_at) : ''} · {(records ?? []).length.toLocaleString()} registros
            {multipleArtists && ` · ${artists.length} artistas`}
          </p>
        </div>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Exportar <ChevronDown className="w-3 h-3" />
          </button>
          <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl z-20 w-56 py-2"
              >
                <p className="text-text-muted text-xs px-3 py-1 font-medium">Vista actual (con filtros)</p>
                <button onClick={() => handleExport('excel', 'filtered')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
                  <FileSpreadsheet className="w-4 h-4 text-green-400" /> Excel
                </button>
                <button onClick={() => handleExport('csv', 'filtered')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
                  <FileType2 className="w-4 h-4 text-blue-400" /> CSV
                </button>
                <button onClick={() => handleExport('pdf', 'filtered')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
                  <FilePdf className="w-4 h-4 text-red-400" /> PDF profesional
                </button>
                <div className="border-t border-border my-1" />
                <p className="text-text-muted text-xs px-3 py-1 font-medium">Reporte completo</p>
                <button onClick={() => handleExport('excel', 'all')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
                  <FileSpreadsheet className="w-4 h-4 text-green-400" /> Excel completo
                </button>
                <button onClick={() => handleExport('pdf', 'all')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 text-text-secondary hover:text-text-primary text-sm transition-colors">
                  <FilePdf className="w-4 h-4 text-red-400" /> PDF completo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Artist module — only when multiple artists detected */}
      {multipleArtists && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {artists.length} artistas detectados
                </h3>
                <p className="text-xs text-text-muted">Selecciona uno para ver sus estadísticas</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setArtistView('global'); setArtistFilter('all') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${artistView === 'global' ? 'bg-primary text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}
              >
                Global
              </button>
              <button
                onClick={() => setArtistView('individual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${artistView === 'individual' ? 'bg-primary text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}
              >
                Por artista
              </button>
            </div>
          </div>

          {/* Artist cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {artistBreakdown.map((a, i) => {
              const pct = totalAll > 0 ? (a.earnings / totalAll * 100).toFixed(1) : '0'
              const isSelected = artistFilter === a.name
              return (
                <button
                  key={a.name}
                  onClick={() => {
                    setArtistFilter(isSelected ? 'all' : a.name)
                    setArtistView('individual')
                  }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border-light bg-surface-2 hover:bg-surface-3'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: COLORS[i % COLORS.length] }}>
                      {a.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-text-primary text-xs font-medium truncate flex-1">{a.name}</span>
                  </div>
                  <p className="text-text-primary text-sm font-semibold">{formatCurrency(a.earnings)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex-1 h-1 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="text-text-muted text-xs">{pct}%</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Per-artist export buttons */}
          {artistFilter !== 'all' && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-text-secondary text-sm">
                Viendo: <span className="text-primary font-medium">{artistFilter}</span>
                <button onClick={() => { setArtistFilter('all'); setArtistView('global') }}
                  className="ml-2 text-text-muted hover:text-text-primary text-xs underline">
                  Ver todos
                </button>
              </p>
              <div className="flex gap-2">
                <button onClick={() => exportExcel(filtered, `royalties-${artistFilter}`)}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" /> Excel
                </button>
                <button onClick={() => exportPdf(filtered, `royalties-${artistFilter}`, artistFilter)}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3">
                  <FilePdf className="w-3.5 h-3.5 text-red-400" /> PDF
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {!multipleArtists && (
          <select value={artistFilter} onChange={e => setArtistFilter(e.target.value)}
            className="input w-auto text-sm py-2 min-w-[160px]">
            <option value="all">Todos los artistas ({artists.length})</option>
            {artists.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
          className="input w-auto text-sm py-2 min-w-[180px]">
          <option value="all">Todas las plataformas ({platforms.length})</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={songFilter} onChange={e => setSongFilter(e.target.value)}
          className="input w-auto text-sm py-2 min-w-[200px]">
          <option value="all">Todas las canciones ({songs.length})</option>
          {songs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="input w-auto text-sm py-2 min-w-[160px]">
          <option value="all">Todos los países ({countries.length})</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(artistFilter !== 'all' || platformFilter !== 'all' || songFilter !== 'all' || countryFilter !== 'all') && (
          <button
            onClick={() => { setArtistFilter('all'); setPlatformFilter('all'); setSongFilter('all'); setCountryFilter('all') }}
            className="btn-ghost text-sm py-2 text-error hover:text-error"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Ingresos totales', value: formatCurrency(totalEarnings), icon: DollarSign, color: 'text-primary',  bg: 'bg-primary/10' },
          { label: 'Total streams',    value: formatNumber(totalStreams),     icon: TrendingUp, color: 'text-success',  bg: 'bg-success/10' },
          { label: 'Top plataforma',   value: topPlatform,                   icon: Radio,      color: 'text-accent',   bg: 'bg-accent/10' },
          { label: 'Top país',         value: topCountry,                    icon: Globe,      color: 'text-warning',  bg: 'bg-warning/10' },
          { label: 'Top canción',      value: topSong,                       icon: Star,       color: 'text-pink-400', bg: 'bg-pink-400/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-text-muted text-xs">{s.label}</p>
                <p className="text-text-primary font-semibold mt-1 text-sm truncate" title={s.value}>{s.value}</p>
              </div>
              <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Platform breakdown */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Ingresos por plataforma</h3>
        <div className="space-y-2">
          {byPlatform.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-text-secondary text-sm w-36 truncate">{p.name}</span>
              <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${(p.earnings / (byPlatform[0]?.earnings || 1)) * 100}%`, background: COLORS[i % COLORS.length] }} />
              </div>
              <span className="text-text-primary text-sm font-medium w-24 text-right">{formatCurrency(p.earnings)}</span>
              <span className="text-text-muted text-xs w-20 text-right">{formatNumber(p.streams)} streams</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By month */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Evolución mensual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                formatter={(v: number) => [formatCurrency(v), 'Ingresos']} />
              <Line type="monotone" dataKey="earnings" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Platform pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Distribución por plataforma</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byPlatform.map(p => ({ name: p.name, value: p.earnings }))}
                cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                {byPlatform.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                formatter={(v: number) => [formatCurrency(v)]} />
              <Legend formatter={v => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Artist comparison — only when multiple and global view */}
      {multipleArtists && artistFilter === 'all' && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Comparación entre artistas <span className="text-text-muted font-normal">({byArtist.length})</span>
          </h3>
          <div style={{ height: Math.max(180, Math.min(byArtist.length * 36, 400)) }} className="overflow-y-auto">
            <ResponsiveContainer width="100%" height={Math.max(180, byArtist.length * 36)}>
              <BarChart data={byArtist.map(a => ({ artist: a.name, earnings: a.earnings }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="artist" tick={{ fill: '#9ca3af', fontSize: 10 }} width={130} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  formatter={(v: number) => [formatCurrency(v), 'Ingresos']} />
                <Bar dataKey="earnings" radius={[0, 4, 4, 0]}>
                  {byArtist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Songs + Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* All songs */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Ingresos por canción <span className="text-text-muted font-normal">({bySong.length})</span>
          </h3>
          <div style={{ height: Math.max(200, Math.min(bySong.length * 36, 480)) }} className="overflow-y-auto">
            <ResponsiveContainer width="100%" height={Math.max(200, bySong.length * 36)}>
              <BarChart data={bySong.map(s => ({ song: s.name, earnings: s.earnings }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="song" tick={{ fill: '#9ca3af', fontSize: 10 }} width={150} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  formatter={(v: number) => [formatCurrency(v), 'Ingresos']} />
                <Bar dataKey="earnings" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* All countries */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Ingresos por país <span className="text-text-muted font-normal">({byCountry.length})</span>
          </h3>
          <div className="space-y-2 overflow-y-auto max-h-96">
            {byCountry.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-text-muted text-xs w-5 text-right flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-secondary text-sm truncate">{c.name}</span>
                    <span className="text-text-primary text-sm font-medium ml-2 flex-shrink-0">{formatCurrency(c.earnings)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full"
                      style={{ width: `${(c.earnings / (byCountry[0]?.earnings || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Album breakdown */}
      {byAlbum.filter(a => a.name && a.name !== '').length > 1 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Ingresos por álbum <span className="text-text-muted font-normal">({byAlbum.length})</span>
          </h3>
          <div className="space-y-2">
            {byAlbum.filter(a => a.name).map((a, i) => (
              <div key={a.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-text-secondary text-sm flex-1 truncate">{a.name}</span>
                <div className="w-40 h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${(a.earnings / (byAlbum[0]?.earnings || 1)) * 100}%`, background: COLORS[i % COLORS.length] }} />
                </div>
                <span className="text-text-primary text-sm font-medium w-24 text-right">{formatCurrency(a.earnings)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

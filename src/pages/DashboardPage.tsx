import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatNumber } from '../lib/utils'
import { DollarSign, TrendingUp, Music, Globe, Upload, Radio, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316', '#84cc16', '#14b8a6']

type SummaryRow = {
  earnings_usd: number
  quantity: number
  store: string
  country: string
  song_title: string
  sale_period: string
}

export default function DashboardPage() {
  const { user, profile } = useAuth()

  const { data: summary } = useQuery<SummaryRow[]>({
    queryKey: ['dashboard-summary', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('royalty_records')
        .select('earnings_usd, quantity, store, country, song_title, sale_period')
        .eq('user_id', user!.id)
      return (data ?? []) as SummaryRow[]
    },
    enabled: !!user,
  })

  const { data: reportsCount } = useQuery<number>({
    queryKey: ['reports-count', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'completed')
      return count ?? 0
    },
    enabled: !!user,
  })

  const rows = summary ?? []
  const totalEarnings   = rows.reduce((acc, r) => acc + r.earnings_usd, 0)
  const totalStreams     = rows.reduce((acc, r) => acc + r.quantity, 0)
  const uniqueSongs     = new Set(rows.map(r => r.song_title)).size
  const uniqueCountries = new Set(rows.map(r => r.country)).size

  // By platform
  const byPlatform = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.store] = (acc[r.store] ?? 0) + r.earnings_usd
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))
   .sort((a, b) => b.value - a.value)

  // By month (last 12)
  const byMonth = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const month = (r.sale_period ?? '').slice(0, 7) || 'Unknown'
      acc[month] = (acc[month] ?? 0) + r.earnings_usd
      return acc
    }, {})
  ).map(([month, earnings]) => ({ month, earnings }))
   .sort((a, b) => a.month.localeCompare(b.month))
   .slice(-12)

  // By song — all
  const bySong = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.song_title] = (acc[r.song_title] ?? 0) + r.earnings_usd
      return acc
    }, {})
  ).map(([song, earnings]) => ({ song, earnings }))
   .sort((a, b) => b.earnings - a.earnings)

  const topPlatform = byPlatform[0]?.name ?? '—'
  const topSong     = bySong[0]?.song     ?? '—'
  const isEmpty     = rows.length === 0

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          Hola, {profile?.full_name?.split(' ')[0] ?? 'bienvenido'} 👋
        </h1>
        <p className="text-text-muted mt-1">Resumen de tus regalías musicales.</p>
      </motion.div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Ingresos totales', value: formatCurrency(totalEarnings), icon: DollarSign, color: 'text-primary',  bg: 'bg-primary/10' },
              { label: 'Total streams',    value: formatNumber(totalStreams),     icon: TrendingUp, color: 'text-success',  bg: 'bg-success/10' },
              { label: 'Canciones',        value: uniqueSongs.toString(),         icon: Music,      color: 'text-accent',   bg: 'bg-accent/10'  },
              { label: 'Países',           value: uniqueCountries.toString(),     icon: Globe,      color: 'text-warning',  bg: 'bg-warning/10' },
            ].map((stat, i) => (
              <motion.div key={stat.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-text-muted text-xs">{stat.label}</p>
                    <p className="text-2xl font-semibold text-text-primary mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Top items row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Top plataforma', value: topPlatform,                      icon: Radio,  color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
              { label: 'Top canción',    value: topSong,                           icon: Star,   color: 'text-pink-400',   bg: 'bg-pink-400/10'   },
              { label: 'Reportes procesados', value: String(reportsCount ?? 0),   icon: Upload, color: 'text-cyan-400',   bg: 'bg-cyan-400/10'   },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }} className="card-sm flex items-center gap-4">
                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-text-muted text-xs">{s.label}</p>
                  <p className="text-text-primary font-semibold text-sm truncate mt-0.5" title={s.value}>{s.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Area chart — full width */}
          <div className="card mb-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Ingresos por mes</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={byMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `$${v}`} width={55} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(v: number) => [formatCurrency(v), 'Ingresos']}
                />
                <Area type="monotone" dataKey="earnings" stroke="#6366f1" fill="url(#earningsGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Platform breakdown — horizontal bars */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Ingresos por plataforma</h3>
              <span className="text-text-muted text-xs">{byPlatform.length} plataformas</span>
            </div>
            <div className="space-y-3">
              {byPlatform.map((p, i) => {
                const pct = totalEarnings > 0 ? (p.value / totalEarnings * 100).toFixed(1) : '0'
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-text-secondary text-sm w-40 truncate">{p.name}</span>
                    <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="text-text-muted text-xs w-10 text-right">{pct}%</span>
                    <span className="text-text-primary text-sm font-medium w-24 text-right">{formatCurrency(p.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Songs chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Top canciones por ingresos</h3>
              <span className="text-text-muted text-xs">{bySong.length} canciones</span>
            </div>
            <div style={{ height: Math.max(180, Math.min(bySong.length * 34, 440)) }} className="overflow-y-auto">
              <ResponsiveContainer width="100%" height={Math.max(180, bySong.length * 34)}>
                <BarChart data={bySong} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="song" tick={{ fill: '#9ca3af', fontSize: 10 }} width={165} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                    formatter={(v: number) => [formatCurrency(v), 'Ingresos']}
                  />
                  <Bar dataKey="earnings" radius={[0, 4, 4, 0]}>
                    {bySong.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* CTA */}
      <div className="mt-6">
        <Link to="/upload" className="card-sm flex items-center gap-4 hover:border-primary/50 transition-colors">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-text-primary font-medium text-sm">Subir nuevo reporte</p>
            <p className="text-text-muted text-xs mt-0.5">DistroKid, SoundOn, TuneCore, CD Baby y más</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mb-4">
        <Music className="w-8 h-8 text-text-muted" />
      </div>
      <h3 className="text-text-primary font-semibold text-lg mb-2">Sin datos aún</h3>
      <p className="text-text-muted text-sm max-w-sm mb-6">
        Sube tu primer reporte para ver el análisis completo de tus regalías.
        <br />Soporta DistroKid, SoundOn, TuneCore, CD Baby y más.
      </p>
      <Link to="/upload" className="btn-primary">Subir primer reporte</Link>
    </motion.div>
  )
}

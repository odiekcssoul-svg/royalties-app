import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatNumber, ratePerK } from '../lib/utils'
import { DollarSign, TrendingUp, Music, Globe, Upload, Radio, Star, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

const PLATFORM_COLORS: Record<string, string> = {
  'Spotify':            '#1DB954',
  'Apple Music':        '#FC3C44',
  'Apple Music / iTunes': '#FC3C44',
  'Tidal':              '#000000',
  'YouTube Music':      '#FF0000',
  'YouTube Music / Content ID': '#FF0000',
  'Amazon Music':       '#00A8E1',
  'TikTok':             '#010101',
  'Deezer':             '#FF0092',
  'Pandora':            '#005483',
}

const getPlatformColor = (name: string) =>
  PLATFORM_COLORS[name] ?? '#6366f1'

type SummaryRow = {
  earnings_usd: number; quantity: number
  store: string; country: string; song_title: string; sale_period: string
}

export default function DashboardPage() {
  const { user, profile } = useAuth()

  const { data: summary } = useQuery<SummaryRow[]>({
    queryKey: ['dashboard-summary', user?.id],
    queryFn: async () => {
      // Fetch all rows with pagination (Supabase default limit is 1000)
      const PAGE = 1000
      let all: SummaryRow[] = []
      let from = 0
      while (true) {
        const { data, error } = await (supabase as any)
          .from('royalty_records')
          .select('earnings_usd, quantity, store, country, song_title, sale_period')
          .eq('user_id', user!.id)
          .range(from, from + PAGE - 1)
        if (error) break
        all = all.concat(data ?? [])
        if (!data || data.length < PAGE) break
        from += PAGE
      }
      return all
    },
    enabled: !!user,
  })

  const { data: reportsCount } = useQuery<number>({
    queryKey: ['reports-count', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('reports').select('*', { count:'exact', head:true })
        .eq('user_id', user!.id).eq('status','completed')
      return count ?? 0
    },
    enabled: !!user,
  })

  const rows = summary ?? []
  const totalEarnings   = rows.reduce((a, r) => a + r.earnings_usd, 0)
  const totalStreams     = rows.reduce((a, r) => a + r.quantity, 0)
  const uniqueSongs     = new Set(rows.map(r => r.song_title)).size
  const uniqueCountries = new Set(rows.map(r => r.country)).size

  // By platform
  const byPlatform = Object.entries(
    rows.reduce<Record<string,{earnings:number;streams:number}>>((acc, r) => {
      if (!acc[r.store]) acc[r.store] = { earnings:0, streams:0 }
      acc[r.store].earnings += r.earnings_usd
      acc[r.store].streams  += r.quantity
      return acc
    }, {})
  ).map(([name, v]) => ({ name, ...v, pct: totalEarnings > 0 ? v.earnings/totalEarnings*100 : 0 }))
   .sort((a,b) => b.earnings - a.earnings)

  // By month
  const byMonth = Object.entries(
    rows.reduce<Record<string,number>>((acc, r) => {
      const m = (r.sale_period ?? '').slice(0,7) || 'Unknown'
      acc[m] = (acc[m] ?? 0) + r.earnings_usd
      return acc
    }, {})
  ).map(([month, earnings]) => ({ month, earnings }))
   .sort((a,b) => a.month.localeCompare(b.month))
   .slice(-6)

  // By song
  const bySong = Object.entries(
    rows.reduce<Record<string,{earnings:number;streams:number}>>((acc, r) => {
      if (!acc[r.song_title]) acc[r.song_title] = { earnings:0, streams:0 }
      acc[r.song_title].earnings += r.earnings_usd
      acc[r.song_title].streams  += r.quantity
      return acc
    }, {})
  ).map(([name, v]) => ({ name, ...v }))
   .sort((a,b) => b.earnings - a.earnings)

  // By country
  const byCountry = Object.entries(
    rows.reduce<Record<string,{earnings:number;streams:number}>>((acc, r) => {
      if (!acc[r.country]) acc[r.country] = { earnings:0, streams:0 }
      acc[r.country].earnings += r.earnings_usd
      acc[r.country].streams  += r.quantity
      return acc
    }, {})
  ).map(([name, v]) => ({ name, ...v, pct: totalStreams > 0 ? v.streams/totalStreams*100 : 0 }))
   .sort((a,b) => b.earnings - a.earnings)

  const topPlatform = byPlatform[0]
  const topSong     = bySong[0]
  const isEmpty     = rows.length === 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
        className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Hola, {profile?.full_name?.split(' ')[0] ?? 'bienvenido'} 👋
          </h1>
          <p className="text-text-muted mt-0.5 text-sm">Resumen de tus regalías musicales.</p>
        </div>
        <Link to="/upload" className="btn-primary gap-2">
          <Upload className="w-4 h-4" /> + Subir Reporte
        </Link>
      </motion.div>

      {isEmpty ? <EmptyState /> : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label:'Ingresos totales', value:formatCurrency(totalEarnings), icon:DollarSign, color:'text-primary',  bg:'bg-primary/10',  iconBg:'#ede9fe' },
              { label:'Total streams',    value:formatNumber(totalStreams),     icon:TrendingUp, color:'text-success',  bg:'bg-success/10',  iconBg:'#d1fae5' },
              { label:'Canciones',        value:uniqueSongs.toString(),         icon:Music,      color:'text-warning',  bg:'bg-warning/10',  iconBg:'#fef3c7' },
              { label:'Países',           value:uniqueCountries.toString(),     icon:Globe,      color:'text-blue-500', bg:'bg-blue-50',     iconBg:'#dbeafe' },
            ].map((stat, i) => (
              <motion.div key={stat.label}
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:i*0.05 }} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-text-muted text-xs font-medium mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: stat.iconBg }}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Top cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Top platform */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.2 }} className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Radio className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-text-muted text-xs font-medium">Top plataforma</p>
                <p className="text-text-primary font-bold truncate">{topPlatform?.name ?? '—'}</p>
                <p className="text-primary text-xs font-medium">
                  {topPlatform ? `${topPlatform.pct.toFixed(0)}% de tus streams` : ''}
                </p>
              </div>
            </motion.div>

            {/* Top song */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.25 }} className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-pink-500" />
              </div>
              <div className="min-w-0">
                <p className="text-text-muted text-xs font-medium">Top canción</p>
                <p className="text-text-primary font-bold truncate">{topSong?.name ?? '—'}</p>
                <p className="text-pink-500 text-xs font-medium">
                  {topSong ? `${formatNumber(topSong.streams)} streams` : ''}
                </p>
              </div>
            </motion.div>

            {/* Reports */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.3 }} className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-text-muted text-xs font-medium">Reportes procesados</p>
                <p className="text-text-primary font-bold">{reportsCount ?? 0}</p>
                <p className="text-blue-500 text-xs font-medium">Este mes</p>
              </div>
            </motion.div>
          </div>

          {/* Chart */}
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:0.3 }} className="card mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-text-primary font-bold">Ingresos por mes</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={byMonth} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="month" tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${v}`} width={55} />
                <Tooltip
                  contentStyle={{ background:'#fff', border:'1px solid #e8eaf2', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ color:'#4b5563', fontWeight:600 }}
                  formatter={(v:number) => [formatCurrency(v), 'Ingresos']}
                />
                <Area type="monotone" dataKey="earnings" stroke="#6366f1" fill="url(#earningsGrad)"
                  strokeWidth={2.5} dot={{ fill:'#6366f1', r:4, strokeWidth:0 }}
                  activeDot={{ r:6, fill:'#6366f1' }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bottom 3 cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Top songs */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.35 }} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Music className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-text-primary font-bold text-sm">Top canciones</h3>
                </div>
                <Link to="/reports" className="text-primary text-xs font-medium hover:underline">Ver todas</Link>
              </div>
              <div className="space-y-3">
                {bySong.slice(0,5).map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="text-text-muted text-xs font-medium w-4 text-center flex-shrink-0">{i+1}</span>
                    <div className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-xs font-semibold truncate">{s.name}</p>
                      <p className="text-text-muted text-xs">{formatNumber(s.streams)} streams</p>
                    </div>
                    <span className="text-primary text-xs font-bold flex-shrink-0">{formatCurrency(s.earnings)}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top countries */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.4 }} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <h3 className="text-text-primary font-bold text-sm">Top países</h3>
                </div>
                <Link to="/reports" className="text-primary text-xs font-medium hover:underline">Ver todas</Link>
              </div>
              <div className="space-y-3">
                {byCountry.slice(0,5).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-text-muted text-xs font-medium w-4 text-center flex-shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-text-primary text-xs font-semibold truncate">{c.name}</p>
                        <span className="text-success text-xs font-bold ml-2">{c.pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full"
                          style={{ width:`${c.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top platforms */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.45 }} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-success/10 rounded-lg flex items-center justify-center">
                    <Radio className="w-3.5 h-3.5 text-success" />
                  </div>
                  <h3 className="text-text-primary font-bold text-sm">Top plataformas</h3>
                </div>
                <Link to="/reports" className="text-primary text-xs font-medium hover:underline">Ver todas</Link>
              </div>
              <div className="space-y-3">
                {byPlatform.slice(0,5).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-text-muted text-xs font-medium w-4 text-center flex-shrink-0">{i+1}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: getPlatformColor(p.name) + '18' }}>
                      <Radio className="w-4 h-4" style={{ color: getPlatformColor(p.name) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-text-muted text-xs">{formatNumber(p.streams)} streams</p>
                    </div>
                    <span className="text-success text-xs font-bold flex-shrink-0">{p.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
        <Music className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-text-primary font-bold text-xl mb-2">Sin datos aún</h3>
      <p className="text-text-muted text-sm max-w-sm mb-8">
        Sube tu primer reporte para ver el análisis completo de tus regalías.
        Soporta DistroKid, SoundOn, TuneCore, CD Baby y más.
      </p>
      <Link to="/upload" className="btn-primary">+ Subir primer reporte</Link>
    </motion.div>
  )
}

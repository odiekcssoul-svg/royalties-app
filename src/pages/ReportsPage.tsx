import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatBytes } from '../lib/utils'
import { FileText, Clock, CheckCircle, XCircle, Loader2, Upload, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Report } from '../types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const statusConfig = {
  completed: { label: 'Completado', icon: CheckCircle, className: 'badge-success' },
  processing: { label: 'Procesando', icon: Loader2, className: 'badge-primary' },
  pending:    { label: 'Pendiente',  icon: Clock,     className: 'badge-warning' },
  error:      { label: 'Error',      icon: XCircle,   className: 'badge-error'   },
}

export default function ReportsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ['reports', user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('reports')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Report[]
    },
    enabled: !!user,
  })

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      // Get file path first
      const report = reports?.find(r => r.id === deleteId)
      if (report?.file_path) {
        await supabase.storage.from('reports').remove([report.file_path])
      }
      // Delete royalty records
      await db.from('royalty_records').delete().eq('report_id', deleteId)
      // Delete report
      await db.from('reports').delete().eq('id', deleteId).eq('user_id', user!.id)

      queryClient.invalidateQueries({ queryKey: ['reports', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['reports-count', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary', user?.id] })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Mis reportes</h1>
          <p className="text-text-muted mt-1">{reports?.length ?? 0} reportes subidos</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" /> Subir reporte
        </Link>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : !reports?.length ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-text-primary font-semibold mb-2">Sin reportes</h3>
          <p className="text-text-muted text-sm mb-6">Sube tu primer reporte de DistroKid o SoundOn.</p>
          <Link to="/upload" className="btn-primary">Subir reporte</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => {
            const cfg = statusConfig[report.status] ?? statusConfig.pending
            const Icon = cfg.icon
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card flex items-center gap-4 hover:border-border-light transition-colors"
              >
                {/* Icon */}
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>

                {/* Info — clickable if completed */}
                {report.status === 'completed' ? (
                  <Link to={`/reports/${report.id}`} className="flex-1 min-w-0 group">
                    <p className="text-text-primary font-medium truncate group-hover:text-primary transition-colors">
                      {report.file_name}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">
                      {formatDate(report.created_at)} · {formatBytes(report.file_size)}
                    </p>
                  </Link>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium truncate">{report.file_name}</p>
                    <p className="text-text-muted text-xs mt-0.5">
                      {formatDate(report.created_at)} · {formatBytes(report.file_size)}
                    </p>
                  </div>
                )}

                {/* Status badge */}
                <div className={`badge ${cfg.className} flex items-center gap-1.5 flex-shrink-0`}>
                  <Icon className={`w-3 h-3 ${report.status === 'processing' ? 'animate-spin' : ''}`} />
                  {cfg.label}
                </div>

                {/* Delete button */}
                <button
                  onClick={() => setDeleteId(report.id)}
                  className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors flex-shrink-0"
                  title="Eliminar reporte"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !deleting && setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-error" />
              </div>
              <h3 className="text-text-primary font-semibold text-center mb-2">¿Eliminar reporte?</h3>
              <p className="text-text-muted text-sm text-center mb-6">
                Se eliminarán el archivo y todos los datos de regalías asociados. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  disabled={deleting}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

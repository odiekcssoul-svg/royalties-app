import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { parseDistroKidFile } from '../lib/distrokid-parser'
import { formatBytes } from '../lib/utils'
import { FileText, CheckCircle, XCircle, Loader2, CloudUpload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export default function UploadPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [reportId, setReportId] = useState('')

  const processFile = async (file: File) => {
    if (!user) return
    setStatus('uploading')
    setError('')

    try {
      // 1. Upload to Storage
      setProgress('Subiendo archivo...')
      const filePath = `${user.id}/${Date.now()}-${file.name}`
      const { error: storageError } = await supabase.storage
        .from('reports')
        .upload(filePath, file)
      if (storageError) throw storageError

      // 2. Create report record
      setProgress('Registrando reporte...')
      const { data: report, error: reportError } = await db
        .from('reports')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type || file.name.split('.').pop() || 'unknown',
          status: 'processing',
        })
        .select()
        .single()
      if (reportError) throw reportError

      // 3. Parse file
      setStatus('processing')
      setProgress('Procesando datos de regalías...')
      const rows = await parseDistroKidFile(file)
      if (rows.length === 0) throw new Error('No se encontraron datos válidos en el archivo.')

      // 4. Insert royalty records in batches
      setProgress(`Guardando ${rows.length} registros...`)
      const BATCH = 500
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map(r => ({
          ...r,
          report_id: report.id,
          user_id: user.id,
        }))
        const { error: insertError } = await db.from('royalty_records').insert(batch)
        if (insertError) throw insertError
      }

      // 5. Mark complete
      await db.from('reports').update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      }).eq('id', report.id)

      // 6. Log activity
      await db.from('activity_logs').insert({
        user_id: user.id,
        action: 'report_uploaded',
        details: { file_name: file.name, records: rows.length, report_id: report.id },
      })

      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['reports-count'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })

      setReportId(report.id)
      setStatus('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar el archivo'
      setError(msg)
      setStatus('error')
    }
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) processFile(accepted[0])
  }, [user])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.txt', '.tsv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: status === 'uploading' || status === 'processing',
  })

  const reset = () => { setStatus('idle'); setError(''); setProgress(''); setReportId('') }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Subir reporte</h1>
        <p className="text-text-muted mt-1">Sube tu reporte de DistroKid en formato CSV o Excel.</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {status === 'idle' || status === 'uploading' || status === 'processing' ? (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-border-light hover:bg-surface-2'}
                ${(status === 'uploading' || status === 'processing') ? 'pointer-events-none opacity-70' : ''}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? 'bg-primary/20' : 'bg-surface-2'}`}>
                  {status === 'uploading' || status === 'processing'
                    ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    : <CloudUpload className={`w-8 h-8 ${isDragActive ? 'text-primary' : 'text-text-muted'}`} />
                  }
                </div>
                {status === 'uploading' || status === 'processing' ? (
                  <div>
                    <p className="text-text-primary font-medium">{progress}</p>
                    <p className="text-text-muted text-sm mt-1">Por favor espera...</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-text-primary font-medium">
                      {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu reporte aquí'}
                    </p>
                    <p className="text-text-muted text-sm mt-1">o haz clic para seleccionar</p>
                    <p className="text-text-muted text-xs mt-3">CSV, TSV, XLS, XLSX · Reportes de DistroKid</p>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 card-sm">
              <p className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Cómo exportar desde DistroKid
              </p>
              <ol className="text-text-muted text-sm space-y-1 list-decimal list-inside">
                <li>Ve a <strong className="text-text-secondary">Bank</strong> en DistroKid</li>
                <li>Haz clic en <strong className="text-text-secondary">Download earnings</strong></li>
                <li>Selecciona el período y descarga el CSV</li>
                <li>Sube ese archivo aquí</li>
              </ol>
            </div>
          </motion.div>
        ) : status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card text-center py-12"
          >
            <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-text-primary font-semibold text-lg mb-2">¡Reporte procesado!</h3>
            <p className="text-text-muted text-sm mb-6">
              Los datos de regalías han sido analizados y guardados correctamente.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="btn-secondary">Subir otro</button>
              <button onClick={() => navigate(`/reports/${reportId}`)} className="btn-primary">
                Ver análisis
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card text-center py-12"
          >
            <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-error" />
            </div>
            <h3 className="text-text-primary font-semibold text-lg mb-2">Error al procesar</h3>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">{error}</p>
            <button onClick={reset} className="btn-primary">Intentar de nuevo</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

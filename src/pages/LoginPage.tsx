import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Music2, Mail, Lock, Eye, EyeOff, Loader2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const WHATSAPP_NUMBER = '573026021232'
const WHATSAPP_MSG    = 'Hola, quiero solicitar acceso a la plataforma de regalías musicales.'

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth()
  const [active,   setActive]   = useState(false) // false=login, true=access
  const [subMode,  setSubMode]  = useState<'login' | 'forgot'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error'
      if (msg.includes('Invalid login credentials')) setError('Correo o contraseña incorrectos.')
      else if (msg.includes('Email not confirmed'))  setError('Debes confirmar tu correo.')
      else setError(msg)
    } finally { setLoading(false) }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await resetPassword(email)
      setSuccess('Te enviamos un email para restablecer tu contraseña.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setLoading(false) }
  }

  const openWhatsApp = () => {
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MSG)}`,
      '_blank'
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Main card */}
      <div
        className="relative w-full max-w-3xl min-h-[520px] rounded-2xl shadow-2xl overflow-hidden border border-border"
        style={{ background: '#111' }}
      >
        {/* ── FORM PANELS (both sit side by side, shifted via translateX) ── */}

        {/* LOGIN FORM — always left */}
        <motion.div
          animate={{ x: active ? '-100%' : '0%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="absolute inset-0 flex"
          style={{ width: '100%' }}
        >
          {/* Login / forgot */}
          <div className="w-full md:w-1/2 h-full flex flex-col justify-center px-8 md:px-12 py-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Music2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-text-primary">Royalties</p>
                <p className="text-text-muted text-xs">Music Analytics</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {subMode === 'login' ? (
                <motion.div key="login"
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0, y:-8 }} transition={{ duration:0.2 }}>
                  <h2 className="text-2xl font-bold text-text-primary mb-1">Iniciar sesión</h2>
                  <p className="text-text-muted text-sm mb-7">Bienvenido de vuelta</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="Correo electrónico" className="input pl-10" required autoComplete="email" />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input type={showPwd ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Contraseña" className="input pl-10 pr-10" required autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {error && (
                      <p className="text-error text-xs bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>
                    )}
                    <button type="button" onClick={() => { setSubMode('forgot'); setError('') }}
                      className="text-xs text-text-muted hover:text-primary transition-colors block">
                      ¿Olvidaste tu contraseña?
                    </button>
                    <button type="submit" disabled={loading}
                      className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {loading ? 'Ingresando...' : 'Iniciar sesión'}
                    </button>
                  </form>
                  {/* Mobile link */}
                  <button onClick={() => setActive(true)}
                    className="mt-5 text-xs text-text-muted hover:text-primary transition-colors block md:hidden text-center">
                    ¿No tienes cuenta? Solicitar acceso →
                  </button>
                </motion.div>
              ) : (
                <motion.div key="forgot"
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0, y:-8 }} transition={{ duration:0.2 }}>
                  <h2 className="text-2xl font-bold text-text-primary mb-1">Recuperar contraseña</h2>
                  <p className="text-text-muted text-sm mb-7">Te enviaremos un link por email</p>
                  {success ? (
                    <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-success text-sm">{success}</div>
                  ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="tu@email.com" className="input pl-10" required />
                      </div>
                      {error && <p className="text-error text-xs bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>}
                      <button type="submit" disabled={loading}
                        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Enviar email
                      </button>
                    </form>
                  )}
                  <button onClick={() => { setSubMode('login'); setError(''); setSuccess('') }}
                    className="mt-4 text-xs text-text-muted hover:text-primary transition-colors block">
                    ← Volver al login
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ACCESS REQUEST FORM — slides in from right */}
        <motion.div
          animate={{ x: active ? '0%' : '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="absolute inset-0 w-full md:w-1/2 flex flex-col justify-center px-8 md:px-12 py-10"
          style={{ left: 0 }}
        >
          <motion.div
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ delay: active ? 0.15 : 0 }}>
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
              <MessageCircle className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Solicitar acceso</h2>
            <p className="text-text-muted text-sm mb-2 leading-relaxed">
              Esta plataforma es <span className="text-text-secondary font-medium">privada</span>.
            </p>
            <p className="text-text-muted text-sm mb-8 leading-relaxed">
              Contacta al administrador para obtener una cuenta. Una vez creada, podrás iniciar sesión con tu correo y contraseña.
            </p>
            <div className="space-y-3">
              <button onClick={openWhatsApp}
                className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-green-500/20">
                <MessageCircle className="w-5 h-5" />
                Solicitar por WhatsApp
              </button>
              <button onClick={() => setActive(false)}
                className="w-full text-xs text-text-muted hover:text-primary transition-colors text-center py-2">
                ← Ya tengo cuenta, iniciar sesión
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* ── OVERLAY PANEL (morado) — slides over the top ── */}
        <motion.div
          animate={{ x: active ? '100%' : '0%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="absolute top-0 right-0 bottom-0 hidden md:flex flex-col items-center justify-center text-center px-10"
          style={{
            width: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '0 1rem 1rem 0',
          }}
        >
          <AnimatePresence mode="wait">
            {!active ? (
              <motion.div key="panel-login"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                transition={{ duration:0.2 }}
                className="space-y-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Music2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-2xl font-bold mb-3">¡Bienvenido!</h3>
                  <p className="text-white/70 text-sm leading-relaxed">
                    ¿Eres nuevo? Solicita acceso al administrador y empieza a analizar tus regalías.
                  </p>
                </div>
                <button onClick={() => setActive(true)}
                  className="border-2 border-white text-white font-semibold px-8 py-2.5 rounded-xl hover:bg-white hover:text-primary transition-all duration-200 w-full">
                  Solicitar acceso
                </button>
              </motion.div>
            ) : (
              <motion.div key="panel-access"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                transition={{ duration:0.2 }}
                className="space-y-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Music2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-2xl font-bold mb-3">¿Ya tienes cuenta?</h3>
                  <p className="text-white/70 text-sm leading-relaxed">
                    Inicia sesión con tus credenciales para acceder al panel.
                  </p>
                </div>
                <button onClick={() => setActive(false)}
                  className="border-2 border-white text-white font-semibold px-8 py-2.5 rounded-xl hover:bg-white hover:text-primary transition-all duration-200 w-full">
                  Iniciar sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

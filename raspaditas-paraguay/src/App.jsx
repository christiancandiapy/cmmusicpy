import { useState } from 'react'
import { supabase } from './supabase'

export default function App() {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkCode(event) {
    event.preventDefault()
    setMessage('')
    if (!code.trim()) return setMessage('Ingresá tu código de participación.')
    if (!supabase) return setMessage('El proyecto todavía no está conectado a Supabase.')

    setLoading(true)
    try {
      // La validación se realiza en servidor; el navegador nunca decide premios.
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { code: code.trim().toUpperCase() }
      })
      if (error) throw error
      setMessage(data?.message || 'Código recibido.')
    } catch (error) {
      setMessage(error.message || 'No se pudo validar el código.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <header className="top">
        <div className="brand-mark">RP</div>
        <div><strong>RASPAdITAS PARAGUAY</strong><small>Una experiencia de premios</small></div>
      </header>
      <section className="hero">
        <div className="eyebrow">JUGÁ · DESCUBRÍ · GANÁ</div>
        <h1>Tu próxima sorpresa<br /><span>está por descubrirse.</span></h1>
        <p>Ingresá tu código de participación para continuar.</p>
        <form className="code-form" onSubmit={checkCode}>
          <label htmlFor="code">Código de participación</label>
          <input id="code" value={code} onChange={e => setCode(e.target.value)}
            placeholder="EJ: RP-XXXX-XXXX" autoCapitalize="characters" />
          <button disabled={loading}>{loading ? 'Verificando…' : 'CONTINUAR'}</button>
        </form>
        {message && <div className="notice" role="status">{message}</div>}
        <div className="secure">🔒 Participaciones verificadas y registradas de forma segura.</div>
      </section>
      <footer>© {new Date().getFullYear()} Raspaditas Paraguay · Términos y condiciones · Política de privacidad</footer>
    </main>
  )
}
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Admin from './Admin.jsx'

function Player() {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [participation, setParticipation] = useState(null)
  const [revealed, setRevealed] = useState({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedCode = params.get('codigo')
    if (linkedCode) setCode(linkedCode.toUpperCase())
  }, [])

  async function checkCode(event) {
    event.preventDefault()
    setMessage('')
    setParticipation(null)
    setRevealed({})
    if (!code.trim()) return setMessage('Ingresá tu código de participación.')
    if (!supabase) return setMessage('El proyecto todavía no está conectado a Supabase.')
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { action: 'check', code: code.trim().toUpperCase() }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setParticipation(data)
      setMessage('Código validado. Elegí un ticket para raspar.')
    } catch (error) {
      setMessage(error.message || 'No se pudo validar el código.')
    } finally {
      setLoading(false)
    }
  }

  async function revealTicket(ticketNumber) {
    if (revealed[ticketNumber] || loading) return
    setLoading(true); setMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { action: 'reveal', code: code.trim().toUpperCase(), ticket_number: ticketNumber }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setRevealed(old => ({ ...old, [ticketNumber]: data }))
      setParticipation(old => ({ ...old, tickets: old.tickets.map(t => t.ticket_number === ticketNumber ? { ...t, status: 'revealed' } : t) }))
    } catch (error) {
      setMessage(error.message || 'No se pudo revelar el ticket.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="page">
    <header className="top"><div className="brand-mark">RP</div><div><strong>RASPAdITAS PARAGUAY</strong><small>Una experiencia de premios</small></div></header>
    <section className="hero">
      <div className="eyebrow">JUGÁ · DESCUBRÍ · GANÁ</div>
      <h1>Tu próxima sorpresa<br/><span>está por descubrirse.</span></h1>
      <p>{code ? 'Tu código llegó en el enlace. Revisalo y continuá.' : 'Ingresá tu código de participación para continuar.'}</p>
      <form className="code-form" onSubmit={checkCode}>
        <label htmlFor="code">Código de participación</label>
        <input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="EJ: RP-XXXX-XXXX" autoCapitalize="characters"/>
        <button disabled={loading}>{loading ? 'Verificando…' : 'CONTINUAR'}</button>
      </form>
      {message && <div className="notice" role="status">{message}</div>}
      {participation && <section className="ticket-area"><h2>{participation.campaign}</h2><p>Seleccioná cada ticket para descubrir su resultado.</p><div className="ticket-grid">{participation.tickets.map(ticket => <article className="ticket-card" key={ticket.ticket_number}><strong>Ticket #{ticket.ticket_number}</strong>{revealed[ticket.ticket_number] ? <div className={revealed[ticket.ticket_number].won ? 'ticket-win' : 'ticket-result'}><b>{revealed[ticket.ticket_number].result}</b>{revealed[ticket.ticket_number].redeem_code && <p>Código para cobrar: <strong>{revealed[ticket.ticket_number].redeem_code}</strong><small>Guardá este código. Se muestra una sola vez.</small></p>}</div> : <button disabled={loading || ticket.status !== 'available'} onClick={() => revealTicket(ticket.ticket_number)}>{ticket.status === 'revealed' ? 'Ya raspado' : 'RASPAR TICKET'}</button>}</article>)}</div></section>}
      <div className="secure">🔒 Cada ticket se revela una sola vez. Los resultados se validan en el servidor.</div>
    </section>
    <footer>© {new Date().getFullYear()} Raspaditas Paraguay · Términos y condiciones · Política de privacidad · <a href="/admin">Administración</a></footer>
  </main>
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin/> : <Player/>
}
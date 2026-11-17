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
      const prior = {}
      for (const ticket of (data.tickets || [])) for (const cell of (ticket.revealed_cells || [])) prior[ticket.ticket_number + '-' + cell.position] = { symbol: cell.symbol }
      setRevealed(prior)
      setMessage('Código validado. Elegí una casilla para raspar.')
    } catch (error) {
      setMessage(error.message || 'No se pudo validar el código.')
    } finally {
      setLoading(false)
    }
  }

  async function revealTicket(ticketNumber, position) {
    const key = ticketNumber + '-' + position
    if (revealed[key] || loading) return
    setLoading(true); setMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { action: 'reveal', code: code.trim().toUpperCase(), ticket_number: ticketNumber, position }
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setRevealed(old => ({ ...old, [key]: data }))
      setParticipation(old => ({ ...old, tickets: old.tickets.map(t => t.ticket_number === ticketNumber ? { ...t, revealed_positions: data.revealed_positions } : t) }))
    } catch (error) {
      setMessage(error.message || 'No se pudo revelar la casilla.')
    } finally {
      setLoading(false)
    }
  }

  function symbolEmoji(symbol) {
    const name = (symbol?.name || '').toLowerCase()
    if (name.includes('auto') || name.includes('veh')) return '🚗'
    if (name.includes('dinero') || name.includes('efectivo') || name.includes('billete')) return '💵'
    if (name.includes('celular') || name.includes('teléfono') || name.includes('telefono')) return '📱'
    if (name.includes('moto')) return '🏍️'
    if (name.includes('regalo')) return '🎁'
    if (name.includes('diamante') || name.includes('joya')) return '💎'
    if (name.includes('trofeo') || name.includes('copa')) return '🏆'
    if (name.includes('reloj')) return '⌚'
    if (name.includes('consola') || name.includes('juego')) return '🎮'
    if (name.includes('premio')) return '🎉'
    return '🎁'
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
      {participation && <section className="ticket-area"><h2>{participation.campaign}</h2><p>¡Raspá las 10 casillas, una por una! Si juntás 3 imágenes iguales, ganás el premio.</p><div className="ticket-grid">{participation.tickets.map(ticket => <article className="ticket-card" key={ticket.ticket_number}><strong>Ticket #{ticket.ticket_number}</strong><div className="scratch-grid">{Array.from({length:10},(_,i)=>{const cell=revealed[ticket.ticket_number+'-'+(i+1)];const wasRevealed=(ticket.revealed_positions||[]).includes(i+1);return <button type="button" className={'scratch-cell '+(cell?'is-revealed':'')} key={i} disabled={loading||wasRevealed} onClick={()=>revealTicket(ticket.ticket_number,i+1)}>{cell?.symbol?<><span className="scratch-emoji">{symbolEmoji(cell.symbol)}</span><small>{cell.symbol.name}</small></>:wasRevealed?'✓':'✦'}</button>})}</div>{Object.entries(revealed).filter(([key])=>key.startsWith(ticket.ticket_number+'-')).some(([,v])=>v.won)&&<div className="ticket-win"><b>¡FELICIDADES! GANASTE</b><p>{Object.entries(revealed).filter(([key])=>key.startsWith(ticket.ticket_number+'-')).find(([,v])=>v.won)?.[1].prize}</p>{Object.entries(revealed).filter(([key])=>key.startsWith(ticket.ticket_number+'-')).find(([,v])=>v.won)?.[1].redeem_code&&<p>Código de canje: <strong>{Object.entries(revealed).filter(([key])=>key.startsWith(ticket.ticket_number+'-')).find(([,v])=>v.won)?.[1].redeem_code}</strong><small>Guardalo. Se muestra una sola vez.</small></p>}</div>}</article>)}</div></section>}
      <div className="secure">🔒 Cada ticket se revela una sola vez. Los resultados se validan en el servidor.</div>
    </section>
    <footer>© {new Date().getFullYear()} Raspaditas Paraguay · Términos y condiciones · Política de privacidad · <a href="/admin">Administración</a></footer>
  </main>
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin/> : <Player/>
}
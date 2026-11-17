import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Admin() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [codes, setCodes] = useState([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [count, setCount] = useState(10)
  const [ticketsPerCode, setTicketsPerCode] = useState(5)
  const [issuedLinks, setIssuedLinks] = useState([])
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [prizes, setPrizes] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [prizeName, setPrizeName] = useState('')
  const [prizeDescription, setPrizeDescription] = useState('')
  const [prizeQuantity, setPrizeQuantity] = useState(1)
  const [sellerCode, setSellerCode] = useState('')
  const [sellerMessage, setSellerMessage] = useState('')
  const [sellerPrize, setSellerPrize] = useState(null)
  const [sellerBusy, setSellerBusy] = useState(false)
  const [newSellerName, setNewSellerName] = useState('')
  const [newSellerEmail, setNewSellerEmail] = useState('')
  const [sellerInviteMessage, setSellerInviteMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) load() }, [session])

  async function load() {
    const { data: p, error: pe } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    if (pe || !p || !['admin', 'super_admin', 'seller'].includes(p.role)) { setProfile(null); setMessage('Tu usuario no tiene permisos de administrador. Solicitá al administrador principal que te asigne un rol autorizado.'); return }
    setProfile(p)
    const [c, co, pr] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('participation_codes').select('id, campaign_id, code_hint, status, assigned_prize_id, tickets_count, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('prizes').select('*').order('created_at', { ascending: false })
    ])
    if (c.error || co.error || pr.error) setMessage('No se pudieron cargar los datos. Revisá las tablas y permisos RLS.')
    setCampaigns(c.data || [])
    setCodes(co.data || [])
    setPrizes(pr.data || [])
    if (!selectedCampaign && c.data?.length) setSelectedCampaign(c.data[0].id)
  }

  async function createPrize(e) {
    e.preventDefault()
    if (!selectedCampaign) return setMessage('Seleccioná una campaña.')
    setBusy(true); setMessage('')
    const { error } = await supabase.from('prizes').insert({ campaign_id: selectedCampaign, name: prizeName.trim(), description: prizeDescription.trim(), quantity_total: Number(prizeQuantity), quantity_reserved: 0, active: true })
    setBusy(false)
    if (error) { setMessage('No se pudo guardar el premio: ' + error.message); return }
    setPrizeName(''); setPrizeDescription(''); setPrizeQuantity(1); setMessage('Premio agregado correctamente.'); await load()
  }

  async function activateCampaign() {
    if (!selectedCampaign) return setMessage('Seleccioná una campaña.')
    const { error } = await supabase.from('campaigns').update({ status: 'active' }).eq('id', selectedCampaign)
    if (error) { setMessage('No se pudo activar: ' + error.message); return }
    setMessage('Campaña activada. Ya puede emitir códigos con premios disponibles.'); await load()
  }

  async function login(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false); if (error) setMessage(error.message)
  }

  async function createSeller(e) {
    e.preventDefault()
    setSellerBusy(true); setSellerInviteMessage('')
    const { data, error } = await supabase.functions.invoke('create-seller', {
      body: { full_name: newSellerName.trim(), email: newSellerEmail.trim() }
    })
    setSellerBusy(false)
    if (error || data?.error) {
      setSellerInviteMessage(data?.error || error.message)
      return
    }
    setSellerInviteMessage(data?.message || 'Invitación enviada.')
    setNewSellerName('')
    setNewSellerEmail('')
  }

  async function redeemPrize(e) {
    e.preventDefault()
    setSellerBusy(true); setSellerMessage(''); setSellerPrize(null)
    const { data, error } = await supabase.rpc('redeem_prize', { p_code: sellerCode.trim().toUpperCase() })
    setSellerBusy(false)
    if (error) { setSellerMessage(error.message); return }
    setSellerPrize(data)
    setSellerMessage(data?.message || 'Canje registrado.')
    setSellerCode('')
  }

  async function createCampaign(e) {
    e.preventDefault()
    if (!campaignName.trim()) return setMessage('Ingresá un nombre para la campaña.')
    setBusy(true); setMessage('')
    const { error } = await supabase.from('campaigns').insert({
      name: campaignName.trim(),
      description: campaignDescription.trim(),
      status: 'draft',
      created_by: session.user.id
    })
    setBusy(false)
    if (error) { setMessage('No se pudo crear la campaña: ' + error.message); return }
    setCampaignName('')
    setCampaignDescription('')
    setMessage('Campaña creada como borrador. Luego configurá sus premios y condiciones.')
    await load()
  }

  async function generateCodes(e) {
    e.preventDefault()
    if (!campaigns.length) return setMessage('Primero necesitás crear una campaña.')
    setBusy(true); setMessage('')
    const { data, error } = await supabase.functions.invoke('issue-codes', {
      body: { campaign_id: selectedCampaign || campaigns[0].id, quantity: Number(count), tickets_per_code: Number(ticketsPerCode) }
    })
    setBusy(false)
    if (error) { setMessage(error.message); return }
    const generated = data?.codes || []
    setIssuedLinks(generated.map(item => ({ code: item.code, url: makeShareUrl(item.code) })))
    setMessage(generated.length ? 'Códigos generados. Copiá o compartí los enlaces ahora: el código completo se muestra una sola vez.' : (data?.message || 'No se generaron códigos.'))
    load()
  }

  function makeShareUrl(code) {
    const url = new URL(window.location.origin + '/')
    url.searchParams.set('codigo', code)
    return url.toString()
  }

  function shareWhatsApp(url, code) {
    const text = encodeURIComponent('¡Tenés una participación en Raspaditas Paraguay! Abrí este enlace para ingresar tu código: ' + url)
    window.open('https://wa.me/?text=' + text, '_blank', 'noopener,noreferrer')
  }

  if (!supabase) return <main className="admin-shell"><section className="login-card"><h1>Panel administrativo</h1><p>Conectá primero el proyecto con Supabase desde las variables de entorno de Netlify.</p></section></main>
  if (!session) return <main className="admin-shell"><form className="login-card" onSubmit={login}><a className="back-link" href="/">← Volver al juego</a><div className="eyebrow">RASPADITAS PARAGUAY</div><h1>Panel administrativo</h1><p>Acceso exclusivo para administradores.</p><label>Correo electrónico<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Ingresando…':'INICIAR SESIÓN'}</button>{message&&<div className="notice">{message}</div>}</form></main>
  if (!profile) return <main className="admin-shell"><section className="login-card"><h1>Acceso restringido</h1><p>{message || 'Verificando permisos…'}</p><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></section></main>

  if (profile?.role === 'seller') return <main className="admin-shell"><header className="admin-top"><div className="brand-link"><div className="brand-mark">RP</div><div><strong>RASPAdITAS PARAGUAY</strong><small>Panel de vendedor</small></div></div><button className="secondary" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></header><section className="admin-content"><div className="admin-heading"><div><div className="eyebrow">CANJE DE PREMIOS</div><h1>Validar premio</h1></div></div><section className="panel"><p className="muted">Ingresá el código que te presenta el participante. Cada código puede canjearse una sola vez.</p><form className="stack-form" onSubmit={redeemPrize}><label>Código de premio<input required autoCapitalize="characters" value={sellerCode} onChange={e=>setSellerCode(e.target.value)} placeholder="PR-XXXXXXXXXX"/></label><button disabled={sellerBusy}>{sellerBusy?'Verificando…':'Validar y confirmar entrega'}</button></form>{sellerMessage&&<div className="notice" role="status">{sellerMessage}</div>}{sellerPrize?.success&&<div className="panel"><h2>Canje confirmado</h2><strong>{sellerPrize.prize}</strong><p>{new Date(sellerPrize.redeemed_at).toLocaleString('es-PY')}</p></div>}</section></section></main>

  return <main className="admin-shell">
    <header className="admin-top"><div className="brand-link"><div className="brand-mark">RP</div><div><strong>RASPAdITAS PARAGUAY</strong><small>Panel de administración</small></div></div><button className="secondary" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></header>
    <section className="admin-content">
      <div className="admin-heading"><div><div className="eyebrow">CENTRO DE CONTROL</div><h1>Administración</h1></div><button className="secondary" onClick={load}>Actualizar</button></div>
      {message&&<div className="notice">{message}</div>}
      <div className="stats-grid"><div className="stat-card"><span>Campañas</span><strong>{campaigns.length}</strong></div><div className="stat-card"><span>Códigos registrados</span><strong>{codes.length}</strong></div></div>
      <section className="panel"><h2>Crear cuenta de vendedor</h2><p className="muted">Se enviará una invitación para que el vendedor configure su propia contraseña. Solo podrá validar canjes.</p><form className="stack-form" onSubmit={createSeller}><label>Nombre completo<input required maxLength="120" value={newSellerName} onChange={e=>setNewSellerName(e.target.value)} placeholder="Nombre y apellido"/></label><label>Correo electrónico<input type="email" required value={newSellerEmail} onChange={e=>setNewSellerEmail(e.target.value)} placeholder="vendedor@gmail.com"/></label><button disabled={sellerBusy}>{sellerBusy?'Enviando…':'Crear vendedor'}</button></form>{sellerInviteMessage&&<div className="notice" role="status">{sellerInviteMessage}</div>}</section>
      <section className="panel"><h2>Crear nueva campaña</h2><p className="muted">Primero creá una campaña. Se guardará como borrador y todavía no estará disponible para participantes.</p><form className="stack-form" onSubmit={createCampaign}><label>Nombre de la campaña<input required maxLength="100" value={campaignName} onChange={e=>setCampaignName(e.target.value)} placeholder="Ej.: Raspadita especial de fin de año"/></label><label>Descripción<textarea maxLength="1000" value={campaignDescription} onChange={e=>setCampaignDescription(e.target.value)} placeholder="Detalles y condiciones generales"/></label><button disabled={busy}>{busy?'Guardando…':'Crear campaña'}</button></form></section>
      <section className="panel"><h2>Campañas registradas</h2>{campaigns.length ? <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Estado</th><th>Creada</th></tr></thead><tbody>{campaigns.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.status}</td><td>{new Date(c.created_at).toLocaleDateString('es-PY')}</td></tr>)}</tbody></table></div> : <p className="muted">Todavía no hay campañas creadas.</p>}</section>
      <section className="panel"><h2>Premios de la campaña</h2><form className="stack-form" onSubmit={createPrize}><label>Campaña<select required value={selectedCampaign} onChange={e=>setSelectedCampaign(e.target.value)}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}</select></label><label>Nombre del premio<input required maxLength="100" value={prizeName} onChange={e=>setPrizeName(e.target.value)} placeholder="Ej.: Vale de G. 50.000"/></label><label>Descripción<input maxLength="500" value={prizeDescription} onChange={e=>setPrizeDescription(e.target.value)}/></label><label>Cantidad disponible<input type="number" min="1" max="10000" required value={prizeQuantity} onChange={e=>setPrizeQuantity(e.target.value)}/></label><button disabled={busy || !campaigns.length}>{busy?'Guardando…':'Agregar premio'}</button></form>{prizes.filter(p=>p.campaign_id===selectedCampaign).map(p=><div className="share-row" key={p.id}><div><strong>{p.name}</strong><small>Reservados: {p.quantity_reserved} / {p.quantity_total}</small></div></div>)}<button className="secondary" disabled={!selectedCampaign || !prizes.some(p=>p.campaign_id===selectedCampaign && p.active && p.quantity_reserved<p.quantity_total)} onClick={activateCampaign}>Activar campaña seleccionada</button></section>
      <section className="panel"><h2>Generar participaciones y enlaces</h2><p className="muted">Los enlaces llevan el código precargado en la página de juego. Compartilos por WhatsApp o copialos para enviarlos por otro medio.</p><form className="generate-row" onSubmit={generateCodes}><label>Cantidad de códigos<input type="number" min="1" max="500" value={count} onChange={e=>setCount(e.target.value)}/></label><label>Tickets por código<input type="number" min="1" max="100" value={ticketsPerCode} onChange={e=>setTicketsPerCode(e.target.value)}/></label><p className="muted">Total previsto: {Number(count || 0) * Number(ticketsPerCode || 0)} tickets</p><button disabled={busy || !campaigns.length}>{busy?'Procesando…':'Generar códigos'}</button></form>{!campaigns.length&&<p className="muted">Todavía no hay campañas. Creá una campaña antes de generar códigos.</p>}</section>
      {issuedLinks.length>0&&<section className="panel"><h2>Enlaces recién generados</h2><p className="muted">Guardá o compartí estos enlaces ahora. Por seguridad, el código completo no se vuelve a mostrar después de salir de esta sesión.</p>{issuedLinks.map((item,i)=><div className="share-row" key={i}><div><strong>{item.code}</strong><small>{item.url}</small></div><button className="secondary" onClick={()=>navigator.clipboard.writeText(item.url)}>Copiar</button><button className="whatsapp" onClick={()=>shareWhatsApp(item.url,item.code)}>WhatsApp</button></div>)}</section>}
      <section className="panel"><h2>Códigos recientes</h2><div className="table-wrap"><table><thead><tr><th>Referencia</th><th>Tickets</th><th>Estado</th><th>Enlace</th></tr></thead><tbody>{codes.map(c=><tr key={c.id}><td>{c.code_hint}</td><td>{c.tickets_count}</td><td>{c.status}</td><td><span className="muted">El enlace completo solo se entrega al generarlo.</span></td></tr>)}</tbody></table></div></section>
      <p className="legal-note">Los códigos se generan con resultados asignados en el servidor. No actives una campaña para premios reales hasta verificar sus condiciones, inventario y autorizaciones aplicables.</p>
    </section>
  </main>
}

function makeShareUrl(code) {
  const url = new URL(window.location.origin + '/')
  url.searchParams.set('codigo', code)
  return url.toString()
}
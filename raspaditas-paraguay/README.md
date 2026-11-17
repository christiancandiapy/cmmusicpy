# Raspaditas Paraguay

Proyecto independiente dentro del repositorio cmmusicpy.

## Estado
Base inicial de frontend y esquema Supabase. No habilita campañas reales ni canje real todavía.

## Stack
- React + Vite
- Netlify
- Supabase Auth + PostgreSQL + Edge Functions

## Desarrollo local
1. Instalar Node.js 20 o superior.
2. Ejecutar `npm install`.
3. Copiar `.env.example` a `.env` y completar las variables públicas de Supabase.
4. Ejecutar `npm run dev`.

## Supabase
Ejecutar `supabase/schema.sql` desde SQL Editor. Luego crear el primer usuario en Supabase Auth y asignarle el perfil administrador según las instrucciones de abajo.

```sql
insert into public.profiles (id, full_name, role)
select id, 'Administrador principal', 'admin'
from auth.users
where email = 'TU_CORREO_ADMIN'
on conflict (id) do update set role = 'admin';
```

La Edge Function `redeem-code` permanece bloqueada (403) hasta implementar el flujo transaccional auditado y realizar las revisiones legales necesarias.

## Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Nunca publicar la clave `service_role`, secretos o credenciales en variables `VITE_*`.

## Aviso
Antes de operar con premios reales, confirmar requisitos legales, permisos, términos y condiciones, restricciones de edad, privacidad y obligaciones tributarias aplicables en Paraguay. Esta base no procesa pagos ni habilita participaciones reales.

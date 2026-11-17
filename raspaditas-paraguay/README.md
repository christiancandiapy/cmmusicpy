# Raspaditas Paraguay

Proyecto independiente dentro del repositorio cmmusicpy.

## Estado
Base inicial React + Vite, panel de administración en `/admin`, esquema Supabase y precarga del código desde enlaces `?codigo=...`.

## Compartir enlaces
El panel está preparado para mostrar enlaces individuales y compartirlos por WhatsApp cuando la función segura `issue-codes` esté implementada y habilitada. El código se entrega una sola vez al administrador; la URL lo precarga en el formulario del participante.

## Configuración
- Base directory en Netlify: `raspaditas-paraguay`
- Build command: `npm run build`
- Publish directory: `dist`
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Supabase
Ejecutar `supabase/schema.sql`. Crear el usuario en Supabase Auth y asignar rol admin:
```sql
insert into public.profiles (id, full_name, role)
select id, 'Administrador principal', 'admin'
from auth.users where email = 'TU_CORREO_ADMIN'
on conflict (id) do update set role = 'admin';
```

La función `redeem-code` continúa bloqueada y debe validarse de forma atómica en servidor. La función `issue-codes` aún no está habilitada; por eso el panel no generará códigos hasta implementarla.

Nunca incluir la clave `service_role` en variables `VITE_*`. Antes de operar con premios reales, confirmar permisos, términos, privacidad, restricciones de edad y obligaciones tributarias aplicables en Paraguay.
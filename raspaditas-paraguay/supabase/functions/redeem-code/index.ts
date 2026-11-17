// Función bloqueada por diseño hasta completar revisión legal y el flujo
// transaccional de canje con auditoría e inventario.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() => new Response(
  JSON.stringify({
    ok: false,
    message: "La participación todavía no está habilitada. Consultá los términos de la campaña."
  }),
  { status: 403, headers: { "content-type": "application/json" } }
));
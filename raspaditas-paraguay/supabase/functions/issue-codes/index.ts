// Generación de códigos deshabilitada intencionalmente.
// Antes de habilitarla se debe implementar: autorización admin, códigos
// criptográficamente aleatorios, hash SHA-256, asignación fija de premio,
// control transaccional de inventario y registro de auditoría.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() => new Response(
  JSON.stringify({
    ok: false,
    message: "La generación de códigos todavía no está habilitada. Completá primero la configuración y revisión de la campaña."
  }),
  { status: 403, headers: { "content-type": "application/json" } }
));
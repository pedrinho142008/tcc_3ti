import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url =
  process.env.SUPABASE_URL ||
  process.env.URL_SUPABASE ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const anon =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

const service =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

console.log("🔍 Supabase config:");
console.log("  URL:", url ? "✅" : "❌");
console.log("  ANON:", anon ? "✅" : "❌");
console.log("  SERVICE:", service ? "✅" : "❌");

if (!url || !anon || !service) {
  console.error("❌ Faltam variáveis Supabase!");
}

// ⚠️ realtime desligado pra não precisar de WebSocket nativo
const opcoes = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { enabled: false },   // ← ESSA LINHA RESOLVE
  global: { headers: { "x-application-name": "tcc-escola" } },
};

export const publicClient = createClient(url || "http://placeholder", anon || "placeholder", opcoes);
export const adminClient = createClient(url || "http://placeholder", service || "placeholder", opcoes);

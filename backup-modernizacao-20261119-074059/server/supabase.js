import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// Aceita TODOS os formatos (antigo JWT + novo sb_*)
const url =
  process.env.SUPABASE_URL ||
  process.env.URL_SUPABASE ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const anon =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const service =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

console.log("🔍 Supabase config:");
console.log("  URL:", url ? "✅" : "❌");
console.log("  ANON:", anon ? `✅ (${anon.slice(0, 20)}...)` : "❌");
console.log("  SERVICE:", service ? `✅ (${service.slice(0, 20)}...)` : "❌");

if (!url || !anon || !service) {
  console.error("❌ Faltam variáveis Supabase no .env");
  console.error("   URL:", !!url, "| ANON:", !!anon, "| SERVICE:", !!service);
}

const opcoes = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { enabled: false },
};

export const publicClient = createClient(
  url || "http://placeholder",
  anon || "placeholder",
  opcoes
);

export const adminClient = createClient(
  url || "http://placeholder",
  service || "placeholder",
  opcoes
);

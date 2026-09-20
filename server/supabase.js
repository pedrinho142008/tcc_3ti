import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url =
  process.env.SUPABASE_URL ||
  process.env.URL_SUPABASE ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const anon =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

const service =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url || !anon || !service) {
  console.error("❌ Faltam variáveis Supabase.");
  process.exit(1);
}

export const publicClient = createClient(url, anon, {
  auth: { persistSession: false },
});

export const adminClient = createClient(url, service, {
  auth: { persistSession: false },
});

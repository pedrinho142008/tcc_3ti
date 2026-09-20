import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_KEY;

if (!url || !anon || !service) {
  console.error("❌ Faltam variáveis SUPABASE_* no .env");
  process.exit(1);
}

export const publicClient = createClient(url, anon, { auth: { persistSession: false } });
export const adminClient = createClient(url, service, { auth: { persistSession: false } });

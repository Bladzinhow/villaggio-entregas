import { createClient } from "@supabase/supabase-js";

// Estas duas variáveis vêm do arquivo .env (veja .env.example).
// Você vai colar aqui a URL e a chave "anon" do seu projeto Supabase.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Faltam as variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. " +
    "Copie .env.example para .env e preencha com os dados do seu projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

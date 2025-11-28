
import { createClient } from '@supabase/supabase-js';

// Configuração Direta para evitar erros de variáveis de ambiente
// URL do Projeto (Project URL)
const SUPABASE_URL = 'https://boocllnhuqukpwvzsulg.supabase.co';

// Chave Pública Anônima (Anon Public Key)
// ATENÇÃO: Use a chave 'anon' pública, NUNCA a 'service_role' ou 'sb_secret'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2NsbG5odXF1a3B3dnpzdWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDA2NzMsImV4cCI6MjA3OTg3NjY3M30.A7eFHGH28mN3t07VmetZmQFeI5rR03FmnvGzPvp8S8s';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials missing! Authentication features will not work.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

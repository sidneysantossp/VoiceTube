import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://boocllnhuqukpwvzsulg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2NsbG5odXF1a3B3dnpzdWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDA2NzMsImV4cCI6MjA3OTg3NjY3M30.A7eFHGH28mN3t07VmetZmQFeI5rR03FmnvGzPvp8S8s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
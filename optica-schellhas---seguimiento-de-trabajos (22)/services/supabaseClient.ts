import { createClient } from '@supabase/supabase-js';

// -------------------------------------------------------------------
// ¡IMPORTANTE!
// Reemplaza los siguientes valores con tu propia URL y clave anónima
// de tu proyecto de Supabase. Puedes encontrarlas en:
// "Project Settings" > "API" en tu dashboard de Supabase.
// -------------------------------------------------------------------
const supabaseUrl = 'https://ydbpbrsbswepzjtzzanr.supabase.co'; // Pega tu URL aquí
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkYnBicnNic3dlcHpqdHp6YW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1Njc1OTYsImV4cCI6MjA3MjE0MzU5Nn0.q_0yyBhlFFwtwdLUv8634_FuOK7bn3mioiWDYDutznk'; // Pega tu clave anónima aquí

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
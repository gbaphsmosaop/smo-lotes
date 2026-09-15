/* =====================================================================
   CONFIGURAÇÃO — este é o único arquivo que você precisa editar.

   Onde achar os dois valores:
     painel do Supabase → Project Settings → Data API
       Project URL  ->  SUPABASE_URL
       anon public  ->  SUPABASE_ANON_KEY

   A chave "anon" é pública de propósito: ela só identifica o projeto.
   Quem manda em quem pode ler e escrever são as políticas de segurança
   dentro do banco (sql/01-banco.sql). Pode versionar no GitHub sem medo.
   A chave "service_role" é que NUNCA pode sair do servidor — não use aqui.
   ===================================================================== */

// ATENÇÃO: cole aqui o "Project URL", com a forma https://SEU-PROJETO.supabase.co
// NÃO cole o endereço da barra do navegador (supabase.com/dashboard/project/...),
// nem deixe barra no fim. Isso causa o erro "Invalid path specified in request URL".
const SUPABASE_URL      = "https://tiuauoefjmtfvcpiicls.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdWF1b2Vmam10ZnZjcGlpY2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MjUxMzcsImV4cCI6MjEwNTAwMTEzN30.u8Nn26KSBZOGYPTYv_Ako1kSCRFf3AeeajyknX-7H-Y";

/* Nome da unidade exibido no rodapé. */
const UNIDADE = "GBAPH / CBMPE — Seção de Material e Operações";

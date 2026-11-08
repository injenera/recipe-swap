// Public community statistics for the homepage hero.
// Counts only publicly-readable tables, so the anon role and RLS apply.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const count = (table: string) =>
    supabase.from(table).select('*', { count: 'exact', head: true });

  const [recipes, cooks, comments, ratings] = await Promise.all([
    count('recipes'),
    count('profiles'),
    count('comments'),
    count('ratings'),
  ]);

  const firstError = [recipes, cooks, comments, ratings].find((r) => r.error)?.error;
  if (firstError) {
    return new Response(JSON.stringify({ error: firstError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      recipes: recipes.count ?? 0,
      cooks: cooks.count ?? 0,
      comments: comments.count ?? 0,
      ratings: ratings.count ?? 0,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

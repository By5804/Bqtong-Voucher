import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { platform } = await req.json();

    if (!platform) {
      return new Response(JSON.stringify({ error: 'Platform dibutuhkan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { count, error } = await supabaseAdmin
      .from('vouchers')
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .eq('platform', platform)
      .eq('status', 'available');

    if (error) {
      console.error('Error marking platform as sold:', error);
      throw error;
    }

    const updatedCount = count || 0;

    if (updatedCount === 0) {
        return new Response(JSON.stringify({ message: `Tidak ada voucher tersedia yang ditemukan untuk platform '${platform}'.`, updatedCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    return new Response(JSON.stringify({ message: `Berhasil menandai ${updatedCount} voucher di platform '${platform}' sebagai terjual.`, updatedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
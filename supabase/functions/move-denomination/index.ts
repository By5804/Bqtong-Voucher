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
    const { sourcePlatform, targetPlatform, denomination } = await req.json();

    if (!sourcePlatform || !targetPlatform || !denomination) {
      return new Response(JSON.stringify({ error: 'Parameter tidak valid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabaseAdmin.rpc('move_denomination', {
      source_platform_name: sourcePlatform,
      target_platform_name: targetPlatform,
      denomination_to_move: denomination,
    });

    if (error) {
      console.error('Error calling move_denomination RPC:', error);
      throw error;
    }

    return new Response(JSON.stringify({ message: `Nominal '${denomination}' berhasil dipindahkan dari '${sourcePlatform}' ke '${targetPlatform}'.` }), {
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
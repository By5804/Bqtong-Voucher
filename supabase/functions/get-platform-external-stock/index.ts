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

    // 1. Get all denominations for the platform
    const { data: platformData, error: denomError } = await supabaseAdmin
      .from('platform_denominations')
      .select('denominations, is_external_stock_enabled, on_hold_denominations')
      .eq('platform_name', platform)
      .single();

    if (denomError || !platformData) {
      console.error(`Platform not found or error fetching denominations for ${platform}:`, denomError);
      return new Response(JSON.stringify({ error: `Platform '${platform}' tidak ditemukan.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    
    if (!platformData.is_external_stock_enabled) {
        return new Response(JSON.stringify({ totalStock: 'N/A' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    const denominations = platformData.denominations || [];
    const onHold = platformData.on_hold_denominations || [];
    const activeDenominations = denominations.filter(d => !onHold.includes(d));

    if (activeDenominations.length === 0) {
      return new Response(JSON.stringify({ totalStock: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Invoke 'check-external-stock' for each active denomination in parallel
    const stockPromises = activeDenominations.map(nominal =>
      supabaseAdmin.functions.invoke('check-external-stock', {
        body: { platform, nominal },
      })
    );

    const results = await Promise.allSettled(stockPromises);

    // 3. Sum up the results
    let totalStock = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const stock = result.value.data?.stock;
        if (typeof stock === 'number') {
          totalStock += stock;
        } else {
          console.warn(`Warning: No valid stock number returned for ${platform} - ${activeDenominations[index]}. Response:`, result.value.data);
        }
      } else {
        console.error(`Error invoking check-external-stock for ${platform} - ${activeDenominations[index]}:`, result.reason);
      }
    });

    return new Response(JSON.stringify({ totalStock }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('get-platform-external-stock error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
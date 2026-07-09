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

    // 1. Get denominations for the platform
    const { data: platformData, error: denomError } = await supabaseAdmin
      .from('platform_denominations')
      .select('denominations, is_external_stock_enabled, on_hold_denominations')
      .eq('platform_name', platform)
      .single();

    if (denomError || !platformData) {
      return new Response(JSON.stringify({ error: `Platform '${platform}' tidak ditemukan.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const denominations = platformData.denominations || [];
    const onHold = platformData.on_hold_denominations || [];
    const activeDenominations = denominations.filter(d => !onHold.includes(d));

    if (activeDenominations.length === 0) {
      return new Response(JSON.stringify({ breakdown: [], totals: { internal: 0, external: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Fetch internal and external stock for each active denomination in parallel
    const stockPromises = activeDenominations.map(async (nominal) => {
      // Internal stock promise
      const internalStockPromise = supabaseAdmin
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('platform', platform)
        .eq('nominal', nominal)
        .eq('status', 'available');

      // External stock promise
      let externalStockPromise;
      if (platformData.is_external_stock_enabled) {
        externalStockPromise = supabaseAdmin.functions.invoke('check-external-stock', {
          body: { platform, nominal },
        });
      } else {
        externalStockPromise = Promise.resolve({ data: { stock: 'N/A' } });
      }

      const [internalResult, externalResult] = await Promise.all([internalStockPromise, externalStockPromise]);

      const internalStock = internalResult.count ?? 0;
      const externalStock = externalResult.data?.stock ?? 'N/A';

      return {
        nominal,
        internal: internalStock,
        external: externalStock,
      };
    });

    const breakdown = await Promise.all(stockPromises);

    // 3. Calculate totals
    const totals = breakdown.reduce((acc, curr) => {
      acc.internal += curr.internal;
      if (typeof curr.external === 'number') {
        acc.external += curr.external;
      }
      return acc;
    }, { internal: 0, external: 0 as number | 'N/A' });
    
    if (breakdown.some(d => d.external === 'N/A')) {
        totals.external = 'N/A';
    }

    return new Response(JSON.stringify({ breakdown, totals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('get-platform-stock-breakdown error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
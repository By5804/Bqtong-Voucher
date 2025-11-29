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

    // 1. Get stock breakdown for the entire platform
    const { data: breakdownData, error: breakdownError } = await supabaseAdmin.functions.invoke('get-platform-stock-breakdown', {
      body: { platform },
    });

    if (breakdownError) {
      throw new Error(`Gagal mengambil rincian stok: ${breakdownError.message}`);
    }

    const stockBreakdown = breakdownData.breakdown || [];
    let totalVouchersMarkedSold = 0;
    const CHUNK_SIZE = 100; // Ukuran batch untuk pembaruan

    // 2. Iterate through each denomination and sync stock
    for (const item of stockBreakdown) {
      const { nominal, internal, external } = item;

      if (typeof internal !== 'number' || typeof external !== 'number') {
        console.warn(`Skipping sync for ${platform} - ${nominal} due to invalid stock data (internal: ${internal}, external: ${external})`);
        continue;
      }

      const quantityToMarkSold = internal - external;

      if (quantityToMarkSold > 0) {
        // Find the oldest vouchers to mark as sold
        const { data: vouchersToUpdate, error: selectError } = await supabaseAdmin
          .from('vouchers')
          .select('id')
          .eq('platform', platform)
          .eq('nominal', nominal)
          .eq('status', 'available')
          .order('created_at', { ascending: true })
          .limit(quantityToMarkSold);

        if (selectError) {
          console.error(`Error selecting vouchers to sync for ${platform} - ${nominal}:`, selectError);
          continue; // Move to the next denomination
        }

        if (vouchersToUpdate && vouchersToUpdate.length > 0) {
          const voucherIds = vouchersToUpdate.map(v => v.id);
          
          // Update in chunks
          for (let i = 0; i < voucherIds.length; i += CHUNK_SIZE) {
            const chunk = voucherIds.slice(i, i + CHUNK_SIZE);
            const { count, error: updateError } = await supabaseAdmin
              .from('vouchers')
              .update({ status: 'sold', sold_at: new Date().toISOString() })
              .in('id', chunk);

            if (updateError) {
              console.error(`Error updating chunk for ${platform} - ${nominal}:`, updateError);
              // Optionally break or continue based on desired error handling
              break; 
            }
            totalVouchersMarkedSold += count || 0;
          }
        }
      }
    }

    if (totalVouchersMarkedSold === 0) {
      return new Response(JSON.stringify({ message: `Stok untuk platform '${platform}' sudah sinkron. Tidak ada voucher yang diubah.`, updatedCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ message: `Sinkronisasi berhasil. Menandai ${totalVouchersMarkedSold} voucher di platform '${platform}' sebagai terjual.`, updatedCount: totalVouchersMarkedSold }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('sync-platform-stock error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
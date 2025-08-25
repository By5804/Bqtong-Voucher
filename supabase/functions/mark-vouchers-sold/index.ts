import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { platform, nominal, quantity } = await req.json();

    if (!platform || !nominal || !quantity || quantity <= 0) {
      return new Response(JSON.stringify({ error: 'Parameter tidak valid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Gunakan service_role key untuk hak akses penuh di server
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Ambil ID voucher tertua yang tersedia sesuai kriteria
    const { data: vouchersToUpdate, error: selectError } = await supabaseAdmin
      .from('vouchers')
      .select('id')
      .eq('platform', platform)
      .eq('nominal', nominal)
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .limit(quantity);

    if (selectError) {
      throw selectError;
    }

    if (!vouchersToUpdate || vouchersToUpdate.length === 0) {
      return new Response(JSON.stringify({ message: 'Tidak ada stok voucher yang cocok ditemukan.', updatedCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const voucherIds = vouchersToUpdate.map(v => v.id);

    // 2. Update status voucher yang terpilih menjadi 'sold'
    const { error: updateError, count } = await supabaseAdmin
      .from('vouchers')
      .update({ status: 'sold' })
      .in('id', voucherIds);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: `${count} voucher berhasil ditandai terjual.`, updatedCount: count }), {
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
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vouchers } = await req.json();

    const encryptionKey = Deno.env.get('VOUCHER_ENCRYPTION_PIN');

    // --- LOGGING SENSITIF UNTUK DEBUGGING (HAPUS SETELAH SELESAI) ---
    console.log('encrypt-voucher: Raw Encryption Key (from env):', encryptionKey);
    // --- AKHIR LOGGING SENSITIF ---

    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0 || !encryptionKey) {
      return new Response(JSON.stringify({ error: 'Parameter tidak valid atau PIN enkripsi tidak ditemukan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const encryptedVouchers = vouchers.map((voucher: any) => ({
      ...voucher,
      code: supabaseAdmin.rpc('pgp_sym_encrypt', {
        val: voucher.code,
        key: encryptionKey,
      }),
    }));

    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .insert(encryptedVouchers);

    if (error) {
      console.error('Error inserting encrypted vouchers:', error);
      throw new Error(`Gagal menyimpan voucher terenkripsi: ${error.message}`);
    }

    return new Response(JSON.stringify({ message: `${vouchers.length} voucher berhasil dienkripsi dan disimpan.`, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge function caught an error:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
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
    const { encryptionKey, filters, from, to } = await req.json();

    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: 'Parameter tidak valid: encryptionKey dibutuhkan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabaseAdmin
      .from('vouchers')
      .select('*, decrypted_code:code', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters) {
      if (filters.searchDate) query = query.eq('tanggal', filters.searchDate);
      if (filters.platform !== 'all') query = query.eq('platform', filters.platform);
      if (filters.source !== 'all') query = query.eq('source', filters.source);
      if (filters.nominal !== 'all') query = query.eq('nominal', filters.nominal);
      if (filters.status !== 'all') query = query.eq('status', filters.status);
      // Note: searchCode cannot be applied directly to encrypted data.
      // It would require decrypting all codes first, which is inefficient and insecure.
      // For now, searchCode will be ignored for encrypted data.
    }

    // Apply range for pagination
    if (from !== undefined && to !== undefined) {
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching encrypted vouchers:', error);
      throw new Error(`Gagal mengambil voucher terenkripsi: ${error.message}`);
    }

    const decryptedVouchers = await Promise.all(data.map(async (voucher: any) => {
      const { data: decryptedData, error: decryptError } = await supabaseAdmin.rpc('pgp_sym_decrypt', {
        val: voucher.code,
        key: encryptionKey,
      });

      if (decryptError) {
        console.warn(`Failed to decrypt voucher ID ${voucher.id}: ${decryptError.message}`);
        return { ...voucher, code: '[DECRYPTION_FAILED]' }; // Mask if decryption fails
      }
      return { ...voucher, code: decryptedData };
    }));

    return new Response(JSON.stringify({ data: decryptedVouchers, count }), {
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
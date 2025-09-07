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
    const { pin, filters, from, to } = await req.json();

    const storedViewPin = Deno.env.get('VOUCHER_VIEW_PIN');

    if (!pin || !storedViewPin) {
      return new Response(JSON.stringify({ error: 'PIN dibutuhkan atau PIN tampilan sistem tidak ditemukan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (pin !== storedViewPin) {
      console.warn('fetch-vouchers-with-pin: PIN mismatch: Client provided PIN does not match stored PIN.');
      return new Response(JSON.stringify({ error: 'PIN tampilan salah.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabaseAdmin
      .from('vouchers')
      .select('*, invoice', { count: 'exact' }) // Menambahkan 'invoice' ke select
      .order('created_at', { ascending: false });

    if (filters) {
      if (filters.searchDate) query = query.eq('tanggal', filters.searchDate);
      if (filters.dateRange && filters.dateRange !== 'all') {
        const today = new Date();
        let startDate: Date;
        switch (filters.dateRange) {
          case 'daily':
            startDate = today;
            break;
          case 'weekly':
            startDate = new Date(today.setDate(today.getDate() - 7));
            break;
          case '2-weeks':
            startDate = new Date(today.setDate(today.getDate() - 14));
            break;
          case 'monthly':
            startDate = new Date(today.setMonth(today.getMonth() - 1));
            break;
          case 'yearly':
            startDate = new Date(today.setFullYear(today.getFullYear() - 1));
            break;
          default:
            startDate = today;
        }
        query = query.gte('tanggal', startDate.toISOString().split('T')[0]);
        query = query.lte('tanggal', new Date().toISOString().split('T')[0]);
      }
      if (filters.platform !== 'all') query = query.eq('platform', filters.platform);
      if (filters.source && filters.source !== 'all') query = query.ilike('source', `%${filters.source}%`); // Menggunakan ilike untuk source
      if (filters.nominal !== 'all') query = query.eq('nominal', filters.nominal);
      if (filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.searchCode) query = query.ilike('code', `%${filters.searchCode}%`);
      if (filters.searchInvoice) query = query.ilike('invoice', `%${filters.searchInvoice}%`); // Menambahkan filter invoice
    }

    if (from !== undefined && to !== undefined) {
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching vouchers with PIN:', error);
      throw new Error(`Gagal mengambil voucher: ${error.message}`);
    }

    return new Response(JSON.stringify({ data, count }), {
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
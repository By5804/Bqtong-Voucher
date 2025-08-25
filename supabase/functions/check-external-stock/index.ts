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
    const { platform, nominal } = await req.json();

    console.log('Received request for platform:', platform, 'nominal:', nominal);

    if (!platform || !nominal) {
      console.error('Validation Error: Platform atau nominal tidak ada.');
      return new Response(JSON.stringify({ error: 'Platform dan nominal dibutuhkan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: productMapping, error: fetchMappingError } = await supabaseAdmin
      .from('product_mappings')
      .select('product_id, game_id, item_type_id, item_info_group_id, item_info_id')
      .eq('platform', platform)
      .eq('nominal', nominal)
      .single();

    if (fetchMappingError) {
      if (fetchMappingError.code === 'PGRST116') {
        const errorMessage = `Mapping untuk ${platform} - ${nominal} tidak ditemukan. Pastikan Anda sudah menambahkan mapping di halaman 'Kelola Mapping Produk'.`;
        console.warn('Mapping Not Found Error:', errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      console.error('Supabase Fetch Mapping Error:', fetchMappingError.message);
      return new Response(JSON.stringify({ error: `Gagal mengambil mapping produk dari database: ${fetchMappingError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Fetched product mapping:', productMapping);

    const scrapeUrl = "https://api-gateway.itemku.com/v1/product";
    
    const finalParams = {
      product_id: productMapping.product_id,
      game_id: String(productMapping.game_id),
      item_type_id: String(productMapping.item_type_id),
      item_info_group_id: productMapping.item_info_group_id ? String(productMapping.item_info_group_id) : undefined,
      item_info_id: String(productMapping.item_info_id),
      is_from_web: '1',
      "country_codes[]": 'ID',
      per_page: '1',
      page: '1',
    };

    const url = new URL(scrapeUrl);
    const filteredParams = Object.fromEntries(Object.entries(finalParams).filter(([, v]) => v !== undefined));
    url.search = new URLSearchParams(filteredParams as Record<string, string>).toString();

    console.log('Calling Itemku API with comprehensive URL:', url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `Gagal mengambil data dari Itemku. Status: ${response.status}. Pesan: ${errorText}`;
      console.error('Itemku API Response Error:', errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502, // Bad Gateway for external API error
      });
    }

    const data = await response.json();
    console.log('Received data from Itemku:', JSON.stringify(data, null, 2));
    
    if (!data?.data || data.data.length === 0) {
      const errorMessage = `API Itemku mengembalikan data kosong atau tidak valid untuk product_id: ${productMapping.product_id}. Mungkin mapping tidak cocok atau produk tidak tersedia.`;
      console.warn('Itemku Data Empty/Invalid Error:', errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404, // Not Found for external data
      });
    }

    const stock = data.data[0].stock ?? 0;
    console.log('Extracted stock:', stock);

    return new Response(JSON.stringify({ stock }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Unhandled Edge function error:', error.message, error);
    return new Response(JSON.stringify({ error: `Terjadi kesalahan tak terduga di server: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
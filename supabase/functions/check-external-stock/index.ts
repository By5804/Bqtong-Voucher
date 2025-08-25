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

    if (!platform || !nominal) {
      return new Response(JSON.stringify({ error: 'Platform dan nominal dibutuhkan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Gunakan service_role key untuk hak akses penuh di server
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch product mapping from the database for the given platform and nominal
    const { data: productMapping, error: fetchMappingError } = await supabaseAdmin
      .from('product_mappings')
      .select('game_id, item_type_id, item_info_group_id, item_info_id')
      .eq('platform', platform)
      .eq('nominal', nominal)
      .single();

    if (fetchMappingError) {
      if (fetchMappingError.code === 'PGRST116') { // No rows found
        return new Response(JSON.stringify({ error: `Mapping untuk ${platform} - ${nominal} tidak ditemukan di database.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      throw fetchMappingError;
    }

    // Proceed to scrape Itemku API using the fetched product mapping
    const scrapeUrl = "https://api-gateway.itemku.com/v1/product";
    const baseParams = {
        is_include_game: '1', is_include_item_type: '1', is_include_item_info_group: '1',
        is_include_order_record: '1', is_from_web: '1', exclude_sharing_account_eligible: '1',
        is_include_upselling_product: '1', use_simple_pagination: '1', per_page: '1', // Cukup ambil 1 produk termurah
        page: '1', sort: 'cheap', is_default_product_list: '1', is_auto_delivery_first: '1',
        is_with_promotion: '1', is_enough_stock: '1', "country_codes[]": 'ID',
        is_exclusive:'false',
        is_include_instant_delivery:'true',
        use_auto_delivery:'true',
    };

    const finalParams = { ...baseParams, ...productMapping }; // Use fetched mapping
    const url = new URL(scrapeUrl);
    url.search = new URLSearchParams(finalParams as Record<string, string>).toString();

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari Itemku: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Asumsi: stok ada di produk pertama dalam array data
    const stock = data?.data?.[0]?.stock ?? 0;

    return new Response(JSON.stringify({ stock }), {
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
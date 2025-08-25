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
      return new Response(JSON.stringify({ error: 'Platform dan nominal dibutuhkan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all relevant mapping details, including store_name
    const { data: productMapping, error: fetchMappingError } = await supabaseAdmin
      .from('product_mappings')
      .select('game_id, item_type_id, item_info_group_id, item_info_id, product_id, store_name') // Menambahkan store_name
      .eq('platform', platform)
      .eq('nominal', nominal)
      .single();

    if (fetchMappingError) {
      if (fetchMappingError.code === 'PGRST116') {
        console.warn(`Mapping not found for ${platform} - ${nominal}`);
        return new Response(JSON.stringify({ error: `Mapping untuk ${platform} - ${nominal} tidak ditemukan di database.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      throw fetchMappingError;
    }

    console.log('Fetched product mapping:', productMapping);

    const scrapeUrl = "https://api-gateway.itemku.com/v1/product";
    
    // Use game_id, item_type_id, item_info_group_id, item_info_id to get a list of products
    // This allows us to then filter by store_name
    const finalParams = {
      game_id: productMapping.game_id.toString(),
      item_type_id: productMapping.item_type_id.toString(),
      item_info_group_id: productMapping.item_info_group_id.toString(),
      item_info_id: productMapping.item_info_id.toString(),
      is_from_web: '1',
      "country_codes[]": 'ID',
      per_page: '50', // Fetch enough items to find the specific store
      page: '1',
      sort: 'cheap', // Sort by cheap to potentially find the best offer from the store
      is_include_game: '1',
      is_include_item_type: '1',
      is_include_item_info_group: '1',
      is_include_order_record: '1',
      exclude_sharing_account_eligible: '1',
      is_include_upselling_product: '1',
      use_simple_pagination: '1',
      is_default_product_list: '1',
      is_auto_delivery_first: '1',
      is_with_promotion: '1',
      is_enough_stock: '1',
      is_exclusive:'false',
      is_include_instant_delivery:'true',
      use_auto_delivery:'true',
    };

    const url = new URL(scrapeUrl);
    url.search = new URLSearchParams(finalParams as Record<string, string>).toString();

    console.log('Calling Itemku API with URL:', url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch data from Itemku: ${response.status} - ${errorText}`);
      throw new Error(`Gagal mengambil data dari Itemku: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Received data from Itemku:', JSON.stringify(data, null, 2));
    
    const competitorList = data?.data || [];
    const storeName = productMapping.store_name;

    const myProduct = competitorList.find((p: any) => p.seller?.shop_name?.toLowerCase() === storeName.toLowerCase());

    let stock = 0;
    if (myProduct) {
      stock = myProduct.stock ?? 0;
      console.log(`Found product for store '${storeName}'. Extracted stock:`, stock);
    } else {
      console.warn(`Product for store '${storeName}' not found in Itemku response.`);
      // If the product_id was also stored, we could try a fallback lookup by product_id here
      // For now, if not found by store_name, stock is 0
      stock = 0;
    }

    return new Response(JSON.stringify({ stock }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Edge function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
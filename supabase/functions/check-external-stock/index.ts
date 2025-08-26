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
    const { platform, nominal } = await req.json(); // nominal sekarang string

    console.log('Received request for platform:', platform, 'nominal:', nominal);

    if (!platform || !nominal) {
      return new Response(JSON.stringify({ error: 'Platform dan nominal dibutuhkan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Jika platform adalah "Itemku Steam Game Key", tidak ada stok eksternal yang bisa dicek
    if (platform === "Itemku Steam Game Key") {
      return new Response(JSON.stringify({ stock: "N/A" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all relevant mapping details, including store_name
    const { data: productMapping, error: fetchMappingError } = await supabaseAdmin
      .from('product_mappings')
      .select('game_id, item_type_id, item_info_group_id, item_info_id, product_id, store_name')
      .eq('platform', platform)
      .eq('nominal', nominal) // Nominal sekarang string
      .single();

    if (fetchMappingError) {
      if (fetchMappingError.code === 'PGRST116') {
        console.warn(`Mapping not found for ${platform} - ${nominal}`);
        return new Response(JSON.stringify({ error: `Mapping untuk ${platform} - ${nominal} tidak ditemukan di database.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      console.error('Error fetching product mapping:', fetchMappingError.message);
      throw fetchMappingError;
    }

    console.log('Fetched product mapping:', productMapping);

    const scrapeUrl = "https://api-gateway.itemku.com/v1/product";
    
    const itemkuApiParams = {
      game_id: productMapping.game_id.toString(),
      item_type_id: productMapping.item_type_id.toString(),
      item_info_group_id: productMapping.item_info_group_id.toString(),
      item_info_id: productMapping.item_info_id.toString(),
      is_include_game: '1', 
      is_include_item_type: '1', 
      is_include_item_info_group: '1',
      is_include_order_record: '1', 
      is_from_web: '1', 
      exclude_sharing_account_eligible: '1',
      is_include_upselling_product: '1', 
      use_simple_pagination: '1', 
      per_page: '50', 
      page: '1', 
      sort: 'cheap', 
      is_default_product_list: '1', 
      is_auto_delivery_first: '1',
      is_with_promotion: '1', 
      "country_codes[]": 'ID',
      is_exclusive:'false',
      is_include_instant_delivery:'true',
      use_auto_delivery:'true',
    };

    // Only add is_enough_stock if nominal is numeric (not for random keys)
    const numNominal = parseInt(nominal, 10);
    if (!isNaN(numNominal)) {
      itemkuApiParams['is_enough_stock'] = '1';
    }


    const url = new URL(scrapeUrl);
    url.search = new URLSearchParams(itemkuApiParams as Record<string, string>).toString();

    console.log('Calling Itemku API with URL:', url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch data from Itemku: ${response.status} - ${errorText}`);
      throw new Error(`Gagal mengambil data dari Itemku: ${response.statusText}. Detail: ${errorText}`);
    }

    const data = await response.json();
    const competitorList = data?.data?.data || []; 
    console.log('Received data from Itemku (first 5 items):', JSON.stringify(competitorList.slice(0, 5), null, 2)); 

    const storeName = productMapping.store_name; // Ini bisa null
    const targetProductId = productMapping.product_id;

    const myProduct = competitorList.find((p: any) => {
      const matchesProductId = p.id?.toString() === targetProductId;
      
      let matchesStoreName = true; // Default ke true jika storeName tidak menjadi faktor
      if (storeName) { // Jika storeName disediakan di mapping kita
        if (p.seller?.shop_name) { // Dan produk Itemku memiliki shop_name
          matchesStoreName = p.seller.shop_name.toLowerCase() === storeName.toLowerCase();
        } else { // Jika storeName disediakan di mapping kita, tetapi produk Itemku tidak memiliki seller.shop_name
          matchesStoreName = false; // Produk ini tidak cocok dengan storeName yang dibutuhkan
        }
      }

      console.log(`Checking product id=${p.id}, shop_name=${p.seller?.shop_name || 'N/A'}: matchesProductId=${matchesProductId}, matchesStoreName=${matchesStoreName}`);
      
      return matchesProductId && matchesStoreName;
    });

    let stock = 0;
    if (myProduct) {
      stock = myProduct.stock ?? 0;
      console.log(`Found product for store '${storeName || 'N/A'}' with product_id '${targetProductId}'. Extracted stock:`, stock);
    } else {
      console.warn(`Product for store '${storeName || 'N/A'}' and product_id '${targetProductId}' not found in Itemku response.`);
      stock = 0;
    }

    return new Response(JSON.stringify({ stock }), {
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
})
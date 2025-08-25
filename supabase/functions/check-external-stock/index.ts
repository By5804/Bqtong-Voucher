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
      .select('game_id, item_type_id, item_info_group_id, item_info_id, product_id, store_name')
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
      console.error('Error fetching product mapping:', fetchMappingError.message);
      throw fetchMappingError;
    }

    console.log('Fetched product mapping:', productMapping);

    const scrapeUrl = "https://api-gateway.itemku.com/v1/product";
    
    // Gunakan semua ID yang relevan untuk pencarian awal
    const finalParams = {
      game_id: productMapping.game_id.toString(),
      item_type_id: productMapping.item_type_id.toString(),
      item_info_group_id: productMapping.item_info_group_id.toString(),
      item_info_id: productMapping.item_info_id.toString(),
      is_from_web: '1',
      "country_codes[]": 'ID',
      per_page: '50', // Ambil cukup banyak untuk memastikan produk kita ditemukan
      page: '1',
      // Hapus parameter 'sort' dan lainnya yang lebih cocok untuk browsing umum
    };

    const url = new URL(scrapeUrl);
    url.search = new URLSearchParams(finalParams as Record<string, string>).toString();

    console.log('Calling Itemku API with URL:', url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch data from Itemku: ${response.status} - ${errorText}`);
      throw new Error(`Gagal mengambil data dari Itemku: ${response.statusText}. Detail: ${errorText}`);
    }

    const data = await response.json();
    console.log('Received data from Itemku:', JSON.stringify(data, null, 2));
    
    const competitorList = data?.data || [];
    const storeName = productMapping.store_name;
    const targetProductId = productMapping.product_id;

    // Filter hasil untuk menemukan produk kita berdasarkan store_name DAN product_id
    const myProduct = competitorList.find((p: any) => 
      p.seller?.shop_name?.toLowerCase() === storeName.toLowerCase() && 
      p.id?.toString() === targetProductId
    );

    let stock = 0;
    if (myProduct) {
      stock = myProduct.stock ?? 0;
      console.log(`Found product for store '${storeName}' with product_id '${targetProductId}'. Extracted stock:`, stock);
    } else {
      console.warn(`Product for store '${storeName}' and product_id '${targetProductId}' not found in Itemku response.`);
      stock = 0;
    }

    return new Response(JSON.stringify({ stock }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) { // Tangkap error umum dan log stack trace
    console.error('Edge function caught an error:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
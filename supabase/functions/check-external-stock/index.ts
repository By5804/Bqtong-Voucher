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

    const { data: productMapping, error: fetchMappingError } = await supabaseAdmin
      .from('product_mappings')
      .select('product_id')
      .eq('platform', platform)
      .eq('nominal', nominal)
      .single();

    if (fetchMappingError) {
      if (fetchMappingError.code === 'PGRST116') {
        const errorMessage = `Mapping untuk ${platform} - ${nominal} tidak ditemukan.`;
        console.warn(errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      throw fetchMappingError;
    }

    console.log('Fetched product mapping:', productMapping);

    const scrapeUrl = "https://api-gateway.itemku.com/v1/product";
    
    // Drastis menyederhanakan parameter untuk fokus pada lookup product_id
    const finalParams = {
      product_id: productMapping.product_id,
      is_from_web: '1', // Parameter ini tampaknya umum dan mungkin diperlukan
    };

    const url = new URL(scrapeUrl);
    url.search = new URLSearchParams(finalParams as Record<string, string>).toString();

    console.log('Calling Itemku API with drastically simplified URL:', url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `Gagal mengambil data dari Itemku. Status: ${response.status}. Pesan: ${errorText}`;
      console.error(errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const data = await response.json();
    console.log('Received data from Itemku:', JSON.stringify(data, null, 2));
    
    if (!data?.data || data.data.length === 0) {
      const errorMessage = `API Itemku mengembalikan data kosong untuk product_id: ${productMapping.product_id}`;
      console.warn(errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const stock = data.data[0].stock ?? 0;
    console.log('Extracted stock:', stock);

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
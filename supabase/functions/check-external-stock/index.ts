import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- KONFIGURASI PRODUK ---
// Anda perlu mengisi ID yang benar dari Itemku untuk setiap produk.
// Saya telah mengisi beberapa contoh berdasarkan permintaan Anda.
const productMappings = {
  "Itemku": {
    "50000": { game_id: 1, item_type_id: 10, item_info_group_id: 100, item_info_id: 1000 },
    "65000": { game_id: 1, item_type_id: 10, item_info_group_id: 100, item_info_id: 1001 },
    "100000": { game_id: 1, item_type_id: 10, item_info_group_id: 100, item_info_id: 1002 },
    // Tambahkan nominal lainnya di sini...
  },
  "LG": {
    // Konfigurasi untuk Lapakgaming akan ditambahkan di sini jika API tersedia
  }
};
// -------------------------

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

    if (platform !== "Itemku") {
       return new Response(JSON.stringify({ stock: 'N/A', message: 'API Scraper belum diimplementasikan untuk platform ini.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const productParams = productMappings[platform]?.[nominal];

    if (!productParams) {
      return new Response(JSON.stringify({ error: `Mapping untuk ${platform} - ${nominal} tidak ditemukan.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

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

    const finalParams = { ...baseParams, ...productParams };
    const url = new URL(scrapeUrl);
    url.search = new URLSearchParams(finalParams).toString();

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
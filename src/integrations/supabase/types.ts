export type Database = {
  public: {
    Tables: {
      vouchers: {
        Row: {
          id: string;
          created_at: string;
          tanggal: string;
          nominal: string;
          platform: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key";
          source: string | null; // Diubah menjadi string | null untuk input teks bebas
          status: 'available' | 'sold';
          code: string;
          invoice: string | null; // Menambahkan kolom invoice
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: string;
          code: string;
          platform: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key";
          source?: string | null; // Diubah menjadi string | null
          status?: 'available' | 'sold';
          invoice?: string | null; // Menambahkan kolom invoice
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: string;
          code?: string;
          platform?: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key";
          source?: string | null; // Diubah menjadi string | null
          status?: 'available' | 'sold';
          invoice?: string | null; // Menambahkan kolom invoice
        };
      };
      product_mappings: {
        Row: {
          id: string;
          platform: string;
          nominal: string;
          game_id: number;
          item_type_id: number;
          item_info_group_id: number;
          item_info_id: number;
          product_id: string;
          created_at: string;
          store_name: string | null;
        };
        Insert: {
          id?: string;
          platform: string;
          nominal: string;
          game_id: number;
          item_type_id: number;
          item_info_group_id: number;
          item_info_id: number;
          product_id: string;
          created_at?: string;
          store_name?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          nominal?: string;
          game_id?: number;
          item_type_id?: number;
          item_info_group_id?: number;
          item_info_id?: number;
          product_id?: string;
          created_at?: string;
          store_name?: string | null;
        };
      };
      platform_denominations: { // Menambahkan tipe untuk tabel baru
        Row: {
          platform_name: string;
          denominations: string[];
          created_at: string;
        };
        Insert: {
          platform_name: string;
          denominations?: string[];
          created_at?: string;
        };
        Update: {
          platform_name?: string;
          denominations?: string[];
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
      };
    };
  };
};
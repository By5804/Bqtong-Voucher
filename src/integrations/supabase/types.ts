export type Database = {
  public: {
    Tables: {
      vouchers: {
        Row: {
          id: string;
          created_at: string;
          tanggal: string;
          nominal: string; // Diubah dari number menjadi string
          platform: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key"; // Menambahkan platform baru
          source: "Paygift website" | "Paygift Sales" | "Tokopedia" | "Manual Adjustment" | "Random" | null; // Menambahkan 'Random'
          status: 'available' | 'sold';
          code: string; // Tetap string di client karena akan didekripsi sebelum ditampilkan
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: string; // Diubah dari number menjadi string
          code: string; // Tetap string di client karena akan dienkripsi sebelum disimpan
          platform: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key"; // Menambahkan platform baru
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | "Manual Adjustment" | "Random" | null; // Menambahkan 'Random'
          status?: 'available' | 'sold';
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: string; // Diubah dari number menjadi string
          code?: string; // Tetap string di client karena akan dienkripsi sebelum disimpan
          platform?: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key"; // Menambahkan platform baru
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | "Manual Adjustment" | "Random" | null; // Menambahkan 'Random'
          status?: 'available' | 'sold';
        };
      };
      product_mappings: {
        Row: {
          id: string;
          platform: string;
          nominal: string; // Diubah dari number menjadi string
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
          nominal: string; // Diubah dari number menjadi string
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
          nominal?: string; // Diubah dari number menjadi string
          game_id?: number;
          item_type_id?: number;
          item_info_group_id?: number;
          item_info_id?: number;
          product_id?: string;
          created_at?: string;
          store_name?: string | null;
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
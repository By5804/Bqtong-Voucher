export type Database = {
  public: {
    Tables: {
      vouchers: {
        Row: {
          id: string;
          created_at: string;
          tanggal: string;
          nominal: string; // Diubah dari number menjadi string
          code: string;
          platform: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key"; // Menambahkan platform baru
          source: "Paygift website" | "Paygift Sales" | "Tokopedia" | "Manual Adjustment" | null; // Menambahkan 'Manual Adjustment'
          status: 'available' | 'sold';
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: string; // Diubah dari number menjadi string
          code: string;
          platform: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key"; // Menambahkan platform baru
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | "Manual Adjustment" | null; // Menambahkan 'Manual Adjustment'
          status?: 'available' | 'sold';
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: string; // Diubah dari number menjadi string
          code?: string;
          platform?: "LG" | "wahyu" | "Itemku" | "Itemku Steam Game Key"; // Menambahkan platform baru
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | "Manual Adjustment" | null; // Menambahkan 'Manual Adjustment'
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
    };
  };
};
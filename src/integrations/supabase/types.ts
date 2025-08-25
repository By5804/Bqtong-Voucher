export type Database = {
  public: {
    Tables: {
      vouchers: {
        Row: {
          id: string;
          created_at: string;
          tanggal: string;
          nominal: number;
          code: string;
          platform: "LG" | "wahyu" | "Itemku";
          source: "Paygift website" | "Paygift Sales" | "Tokopedia" | null;
          status: 'available' | 'sold'; // Kolom baru
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: number;
          code: string;
          platform: "LG" | "wahyu" | "Itemku";
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | null;
          status?: 'available' | 'sold'; // Kolom baru
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: number;
          code?: string;
          platform?: "LG" | "wahyu" | "Itemku";
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | null;
          status?: 'available' | 'sold'; // Kolom baru
        };
      };
      product_mappings: {
        Row: {
          id: string;
          platform: string;
          nominal: number;
          game_id: number;
          item_type_id: number;
          item_info_group_id: number;
          item_info_id: number;
          product_id: string; // Diubah menjadi non-nullable
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: string;
          nominal: number;
          game_id: number;
          item_type_id: number;
          item_info_group_id: number;
          item_info_id: number;
          product_id: string; // Diubah menjadi wajib
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: string;
          nominal?: number;
          game_id?: number;
          item_type_id?: number;
          item_info_group_id?: number;
          item_info_id?: number;
          product_id?: string; // Diubah menjadi string non-nullable
          created_at?: string;
        };
      };
    };
  };
};
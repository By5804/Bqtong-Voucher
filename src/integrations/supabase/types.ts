export type Database = {
  public: {
    Tables: {
      vouchers: {
        Row: {
          id: string;
          created_at: string;
          tanggal: string;
          nominal: string;
          platform: string;
          source: string | null;
          status: 'available' | 'sold';
          code: string;
          invoice: string | null;
          sold_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: string;
          code: string;
          platform: string;
          source?: string | null;
          status?: 'available' | 'sold';
          invoice?: string | null;
          sold_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: string;
          code?: string;
          platform?: string;
          source?: string | null;
          status?: 'available' | 'sold';
          invoice?: string | null;
          sold_at?: string | null;
        };
      };
      product_mappings: {
        Row: {
          id: string;
          platform: string;
          nominal: string;
          game_id: number;
          item_type_id: number;
          item_info_group_id: number | null;
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
          item_info_group_id: number | null;
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
          item_info_group_id?: number | null;
          item_info_id?: number;
          product_id?: string;
          created_at?: string;
          store_name?: string | null;
        };
      };
      platform_denominations: {
        Row: {
          platform_name: string;
          denominations: string[];
          created_at: string;
          is_external_stock_enabled: boolean | null;
          is_visible_on_dashboard: boolean;
          sort_order: number;
          on_hold_denominations: string[] | null;
        };
        Insert: {
          platform_name: string;
          denominations?: string[];
          created_at?: string;
          is_external_stock_enabled?: boolean | null;
          is_visible_on_dashboard?: boolean;
          sort_order?: number;
          on_hold_denominations?: string[] | null;
        };
        Update: {
          platform_name?: string;
          denominations?: string[];
          created_at?: string;
          is_external_stock_enabled?: boolean | null;
          is_visible_on_dashboard?: boolean;
          sort_order?: number;
          on_hold_denominations?: string[] | null;
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
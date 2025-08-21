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
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: number;
          code: string;
          platform: "LG" | "wahyu" | "Itemku";
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: number;
          code?: string;
          platform?: "LG" | "wahyu" | "Itemku";
        };
      };
    };
  };
};
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
          platform: "LG" | "wahyu" | "Itemku" | "Paygift website" | "Paygift Sales" | "Tokopedia";
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: number;
          code: string;
          platform: "LG" | "wahyu" | "Itemku" | "Paygift website" | "Paygift Sales" | "Tokopedia";
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: number;
          code?: string;
          platform?: "LG" | "wahyu" | "Itemku" | "Paygift website" | "Paygift Sales" | "Tokopedia";
        };
      };
    };
  };
};
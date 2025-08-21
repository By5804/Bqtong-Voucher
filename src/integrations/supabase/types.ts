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
        };
        Insert: {
          id?: string;
          created_at?: string;
          tanggal: string;
          nominal: number;
          code: string;
          platform: "LG" | "wahyu" | "Itemku";
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          tanggal?: string;
          nominal?: number;
          code?: string;
          platform?: "LG" | "wahyu" | "Itemku";
          source?: "Paygift website" | "Paygift Sales" | "Tokopedia" | null;
        };
      };
    };
  };
};
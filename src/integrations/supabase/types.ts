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
    };
  };
};
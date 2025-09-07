"use client";

import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { StockDisplay } from "@/components/StockDisplay";
import { MarkSoldQuickAction } from "@/components/MarkSoldQuickAction";
import { ViewSoldVouchersQuickAction } from "@/components/ViewSoldVouchersQuickAction";
import { ManageProductMappingsQuickAction } from "@/components/ManageProductMappingsQuickAction";
import { ManageDenominationsQuickAction } from "@/components/ManageDenominationsQuickAction"; // Import komponen baru
import { PlusCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [stockKey, setStockKey] = useState(0);
  const refreshStockDisplay = () => setStockKey(prev => prev + 1);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [loadingServerTime, setLoadingServerTime] = useState(true);
  const { toast } = useToast();

  const fetchServerTime = useCallback(async () => {
    setLoadingServerTime(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-server-time');
      if (error) {
        console.error("Error fetching server time:", error.message);
        toast({ title: "Error", description: `Gagal memuat waktu server: ${error.message}`, variant: "destructive" });
        setServerTime(null);
      } else {
        setServerTime(data.timestamp);
      }
    } catch (err: any) {
      console.error("General error fetching server time:", err.message);
      toast({ title: "Error", description: `Terjadi kesalahan saat memuat waktu server: ${err.message}`, variant: "destructive" });
      setServerTime(null);
    } finally {
      setLoadingServerTime(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchServerTime();
    const interval = setInterval(fetchServerTime, 60 * 1000); // Refresh server time every minute
    return () => clearInterval(interval);
  }, [fetchServerTime]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Sistem Manajemen Voucher</h1>
        <p className="text-xl text-gray-600">
          Kelola data voucher redeem dengan mudah
        </p>
      </div>

      <StockDisplay key={stockKey} />
      
      <div className="text-center flex flex-col items-center gap-4 w-full max-w-4xl">
        <p className="text-lg mb-2">Aksi Cepat:</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild>
            <Link to="/vouchers">Lihat & Hapus Voucher</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/input-vouchers">Input Voucher Massal</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/move-vouchers">Pindahkan Voucher</Link>
          </Button>
          <MarkSoldQuickAction onActionComplete={refreshStockDisplay} />
          <ViewSoldVouchersQuickAction />
          <Button asChild variant="success" className="bg-green-600 hover:bg-green-700 text-white">
            <Link to="/manual-stock-adjustment">
              <span className="flex items-center">
                <PlusCircle className="mr-2 h-4 w-4" /> Tambah Stok Manual
              </span>
            </Link>
          </Button>
          <ManageProductMappingsQuickAction />
          <ManageDenominationsQuickAction /> {/* Menambahkan aksi cepat baru */}
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground mt-8">
        {loadingServerTime ? (
          <span>Memuat waktu server...</span>
        ) : serverTime ? (
          <span>Waktu Server: {new Date(serverTime).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}</span>
        ) : (
          <span>Gagal memuat waktu server.</span>
        )}
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default Index;
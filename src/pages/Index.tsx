"use client";

import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { StockDisplay } from "@/components/StockDisplay";
import { MarkSoldQuickAction } from "@/components/MarkSoldQuickAction";
import { ViewSoldVouchersQuickAction } from "@/components/ViewSoldVouchersQuickAction";
import { ManageProductMappingsQuickAction } from "@/components/ManageProductMappingsQuickAction";
import { ManageDenominationsQuickAction } from "@/components/ManageDenominationsQuickAction";
import { MoveVouchersQuickAction } from "@/components/MoveVouchersQuickAction";
import { MoveDenominationQuickAction } from "@/components/MoveDenominationQuickAction";
import { SyncPlatformStockQuickAction } from "@/components/SyncPlatformStockQuickAction";
import { PlusCircle, Database, FileText, LayoutDashboard, Clock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

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
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-8 md:p-12 gap-8 selection:bg-indigo-500/10">
      <div className="max-w-7xl w-full mx-auto space-y-10 flex-1">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-8 gap-4">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full font-semibold">
                v2.1 Production
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Voucher Management Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Kelola stok voucher, sinkronisasi platform itemku, dan pantau penjualan instan.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 px-4 py-2.5 rounded-2xl shadow-sm self-start lg:self-center">
            <Clock className="h-4 w-4 text-indigo-500 animate-pulse" />
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Live Server Time</div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {loadingServerTime ? (
                  <span className="opacity-50">Memuat...</span>
                ) : serverTime ? (
                  new Date(serverTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                ) : (
                  <span className="text-red-500">Offline</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Stock Display */}
        <StockDisplay key={stockKey} />
        
        {/* Actions Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Panel Kontrol Utama</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            <Button asChild className="h-12 rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-100 dark:shadow-none hover:shadow-indigo-200">
              <Link to="/vouchers">
                <FileText className="mr-2 h-4 w-4" /> Lihat & Hapus Voucher
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-12 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Link to="/input-vouchers">
                <Database className="mr-2 h-4 w-4" /> Input Voucher Massal
              </Link>
            </Button>

            <Button asChild variant="default" className="h-12 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-100 dark:shadow-none">
              <Link to="/manual-stock-adjustment">
                <PlusCircle className="mr-2 h-4 w-4" /> Tambah Stok Manual
              </Link>
            </Button>

            <MoveVouchersQuickAction onActionComplete={refreshStockDisplay} />
            <MarkSoldQuickAction onActionComplete={refreshStockDisplay} />
            <SyncPlatformStockQuickAction onActionComplete={refreshStockDisplay} />
            <ViewSoldVouchersQuickAction />
            <ManageProductMappingsQuickAction />
            <ManageDenominationsQuickAction />
            <MoveDenominationQuickAction />
          </div>
        </div>

      </div>

      <div className="pt-8 border-t border-slate-200/60 dark:border-slate-800/60">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;
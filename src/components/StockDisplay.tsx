"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type Platform = "LG" | "wahyu" | "Itemku";
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];
const ALL_NOMINAL_OPTIONS = [100, 200, 50000, 65000, 100000, 200000, 300000, 500000];

const formatNominalDisplay = (nominal: number) => {
  if (nominal === 100) return "100 RBX";
  if (nominal === 200) return "200 RBX";
  return (nominal / 1000).toLocaleString('id-ID') + 'K';
};

type StockData = {
  platform: Platform;
  nominal: number;
  internal: number;
  external: number | 'N/A' | 'loading' | null;
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalStates, setLoadingExternalStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Memuat stok internal dari database Anda
  const fetchInternalStock = useCallback(async () => {
    setLoadingInternal(true);
    const initialStockPromises: Promise<Omit<StockData, 'external'>>[] = [];
    
    for (const platform of platformOptions) {
      const nominalsForPlatform = platform === "Itemku" 
        ? ALL_NOMINAL_OPTIONS 
        : ALL_NOMINAL_OPTIONS.filter(n => n >= 50000);

      for (const nominal of nominalsForPlatform) {
        const promise = supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform)
          .eq("nominal", nominal)
          .eq("status", "available")
          .then(({ count }) => ({ platform, nominal, internal: count || 0 }));
        initialStockPromises.push(promise);
      }
    }
    
    const internalResults = await Promise.all(initialStockPromises);
    // Set status eksternal default ke null (belum dicek) daripada loading otomatis
    const initialData = internalResults.map(item => ({ ...item, external: null as any }));
    setStock(initialData);
    setLoadingInternal(false);
  }, []);

  // Menjalankan scraping stok eksternal secara manual untuk platform tertentu
  const fetchExternalStockForPlatform = async (targetPlatform: Platform) => {
    if (targetPlatform !== "Itemku") {
      toast({
        title: "Info",
        description: `Stok eksternal belum diimplementasikan untuk platform ${targetPlatform}.`,
      });
      return;
    }

    setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: true }));

    // Set tampilan nominal yang bersangkutan ke 'loading'
    setStock(prevStock => 
      prevStock.map(s => 
        s.platform === targetPlatform ? { ...s, external: 'loading' } : s
      )
    );

    const platformItems = stock.filter(item => item.platform === targetPlatform);

    const externalStockPromises = platformItems.map(async (item) => {
      try {
        const { data, error } = await supabase.functions.invoke('check-external-stock', {
          body: { platform: item.platform, nominal: item.nominal },
        });
        if (error) throw new Error(error.message);
        return { ...item, external: data.stock };
      } catch (err: any) {
        console.error(`Gagal mengambil stok eksternal untuk ${item.platform} ${item.nominal}:`, err);
        return { ...item, external: 'N/A' as const };
      }
    });

    const results = await Promise.all(externalStockPromises);

    // Update state akhir setelah semua scraping selesai
    setStock(prevStock => 
      prevStock.map(s => {
        if (s.platform === targetPlatform) {
          const matchedResult = results.find(r => r.nominal === s.nominal);
          return matchedResult ? { ...s, external: matchedResult.external } : s;
        }
        return s;
      })
    );

    setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: false }));
    toast({
      title: "Sinkronisasi Selesai",
      description: `Stok eksternal untuk ${targetPlatform} berhasil diperbarui.`,
    });
  };

  useEffect(() => {
    fetchInternalStock();
  }, [fetchInternalStock]);

  const isLoading = loadingInternal;

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Stok Voucher Tersedia</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading
            ? platformOptions.map((p) => (
                <Card key={p}>
                  <CardHeader><CardTitle><Skeleton className="h-6 w-24" /></CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {ALL_NOMINAL_OPTIONS.filter(n => p === "Itemku" || n >= 50000).map((n) => (
                      <div key={`${p}-${n}`} className="flex justify-between items-center">
                        <span><Skeleton className="h-4 w-16" /></span>
                        <span><Skeleton className="h-4 w-8" /></span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            : platformOptions.map((platform) => (
                <Card key={platform}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-bold">{platform}</CardTitle>
                    {platform === "Itemku" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => fetchExternalStockForPlatform(platform)}
                        disabled={loadingExternalStates[platform]}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${loadingExternalStates[platform] ? 'animate-spin' : ''}`} />
                        Cek Stok
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stock
                      .filter(item => item.platform === platform)
                      .sort((a, b) => a.nominal - b.nominal)
                      .map(({ nominal, internal, external }) => (
                        <div key={`${platform}-${nominal}`} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            {formatNominalDisplay(nominal)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Ext:</span>
                                {external === null ? (
                                  <span className="text-xs text-muted-foreground italic">klik cek</span>
                                ) : external === 'loading' ? (
                                  <Skeleton className="h-4 w-6" />
                                ) : (
                                  <span className="font-semibold text-sm">{external}</span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Stok di Platform Eksternal (Itemku)</p>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-gray-300">|</span>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Int:</span>
                                <span className="text-lg font-bold">{internal}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Stok di Database Internal Anda</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
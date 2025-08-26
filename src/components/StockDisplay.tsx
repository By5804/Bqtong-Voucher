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
const ALL_NOMINAL_OPTIONS = [100, 200, 400, 50000, 65000, 100000, 200000, 300000, 500000];

const formatNominalDisplay = (nominal: number) => {
  if (nominal === 100) return "100 RBX";
  if (nominal === 200) return "200 RBX";
  if (nominal === 400) return "400 RBX";
  return (nominal / 1000).toLocaleString('id-ID') + 'K';
};

type StockData = {
  platform: Platform;
  nominal: number;
  internal: number;
  external: number | 'N/A' | 'loading' | null;
};

// Helper function for nominals based on platform
const getNominalsForPlatform = (currentPlatform: Platform) => {
  if (currentPlatform === "Itemku") {
    return ALL_NOMINAL_OPTIONS;
  } else if (currentPlatform === "LG" || currentPlatform === "wahyu") {
    return ALL_NOMINAL_OPTIONS.filter(n => [50000, 65000, 200000].includes(n));
  }
  return []; 
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalLG, setLoadingExternalLG] = useState(false);
  const [loadingExternalItemku, setLoadingExternalItemku] = useState(false);
  const { toast } = useToast();

  // Fungsi untuk mengambil stok internal (berjalan otomatis saat mount)
  const fetchInternalStock = async () => {
    setLoadingInternal(true);
    const initialStockPromises: Promise<Omit<StockData, 'external'>>[] = [];
    for (const platform of platformOptions) {
      const nominalsForPlatform = getNominalsForPlatform(platform); // Use helper function

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
    
    const initialData = internalResults.map(item => ({ 
      ...item, 
      external: (item.platform === "Itemku" || item.platform === "LG") ? null : 'N/A' as const 
    }));
    setStock(initialData);
    setLoadingInternal(false);
  };

  // Fungsi umum untuk mengambil stok eksternal untuk platform tertentu
  const fetchExternalStockForPlatform = useCallback(async (targetPlatform: Platform, setLoading: (loading: boolean) => void) => {
    setLoading(true);
    
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

          console.log(`[StockDisplay] Invoke result for ${item.platform} ${item.nominal}:`, { data, error });

          if (error) {
            console.error(`[StockDisplay] Frontend error for ${item.platform} ${item.nominal}:`, error);
            if (error.status === 404 && error.context?.body) {
                const errorBody = JSON.parse(error.context.body);
                toast({ title: "Error", description: errorBody.error, variant: "destructive" });
            } else {
                toast({ title: "Error", description: `Gagal memuat stok eksternal untuk ${item.platform} ${formatNominalDisplay(item.nominal)}: ${error.message}`, variant: "destructive" });
            }
            return { ...item, external: 'N/A' as const };
          }
          return { ...item, external: data.stock };
        } catch (err: any) {
          console.error(`[StockDisplay] General catch error for ${item.platform} ${item.nominal}:`, err);
          toast({ title: "Error", description: `Terjadi kesalahan saat memuat stok eksternal untuk ${item.platform} ${formatNominalDisplay(item.nominal)}: ${err.message}`, variant: "destructive" });
          return { ...item, external: 'N/A' as const };
        }
    });

    const results = await Promise.all(externalStockPromises);
    setStock(prevStock => {
        const newStock = prevStock.map(s => {
            const updatedItem = results.find(r => r.platform === s.platform && r.nominal === s.nominal);
            return updatedItem ? updatedItem : s;
        });
        return newStock;
    });

    setLoading(false);
  }, [stock, toast]);

  const fetchExternalStockLG = useCallback(() => {
    fetchExternalStockForPlatform("LG", setLoadingExternalLG);
  }, [fetchExternalStockForPlatform]);

  const fetchExternalStockItemku = useCallback(() => {
    fetchExternalStockForPlatform("Itemku", setLoadingExternalItemku);
  }, [fetchExternalStockForPlatform]);

  useEffect(() => {
    fetchInternalStock();
  }, []);

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Stok Voucher Tersedia</h2>
        
        <div className="flex justify-center mb-6 gap-4">
          <Button 
            onClick={fetchExternalStockLG} 
            disabled={loadingExternalLG}
            className="flex items-center gap-2"
          >
            {loadingExternalLG ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Memuat Stok LG...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> Refresh Stok LG
              </>
            )}
          </Button>
          <Button 
            onClick={fetchExternalStockItemku} 
            disabled={loadingExternalItemku}
            className="flex items-center gap-2"
          >
            {loadingExternalItemku ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Memuat Stok Itemku...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> Refresh Stok Itemku
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loadingInternal
            ? platformOptions.map((p) => (
                <Card key={p}>
                  <CardHeader><CardTitle><Skeleton className="h-6 w-24" /></CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {getNominalsForPlatform(p).map((n) => (
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
                  <CardHeader>
                    <CardTitle>{platform}</CardTitle>
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
                                  <span className="text-sm text-muted-foreground">Klik Refresh</span>
                                ) : external === 'loading' ? (
                                  <Skeleton className="h-4 w-6" />
                                ) : (
                                  <span className="font-semibold text-sm">{external}</span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Stok di Platform Eksternal (Itemku/LG)</p>
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
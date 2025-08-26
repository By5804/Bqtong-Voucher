"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"];
const visiblePlatformOptions: Platform[] = platformOptions.filter(p => p !== "wahyu"); // Filter out "wahyu"

const formatNominalDisplay = (nominal: string | number) => {
  const strNominal = String(nominal);
  if (strNominal === "100") return "100 RBX";
  if (strNominal === "200") return "200 RBX";
  if (strNominal === "400") return "400 RBX";
  if (strNominal.includes("Random Steam Key")) return strNominal;

  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return numNominal.toLocaleString('id-ID') + 'K';
  }
  return strNominal;
};

type StockData = {
  platform: Platform;
  nominal: string;
  internal: number;
  external: number | 'N/A' | 'loading' | null;
};

const getNominalsForPlatform = (currentPlatform: Platform) => {
  if (currentPlatform === "Itemku") {
    return ["100", "200", "400", "50000", "65000", "100000", "200000", "300000", "500000"];
  } else if (currentPlatform === "LG" || currentPlatform === "wahyu") {
    return ["50000", "65000", "200000"];
  } else if (currentPlatform === "Itemku Steam Game Key") {
    return ["Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];
  }
  return []; 
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalLG, setLoadingExternalLG] = useState(false);
  const [loadingExternalItemku, setLoadingExternalItemku] = useState(false);
  const [loadingExternalItemkuSteam, setLoadingExternalItemkuSteam] = useState(false);
  const { toast } = useToast();

  const fetchInternalStock = async () => {
    setLoadingInternal(true);
    const initialStockPromises: Promise<Omit<StockData, 'external'>>[] = [];
    for (const platform of visiblePlatformOptions) { // Use visiblePlatformOptions here
      const nominalsForPlatform = getNominalsForPlatform(platform);

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
      external: item.platform === "wahyu" ? 'N/A' : (item.platform === "Itemku" || item.platform === "LG" || item.platform === "Itemku Steam Game Key") ? null : 'N/A' as const 
    }));
    setStock(initialData);
    setLoadingInternal(false);
  };

  const fetchExternalStockForPlatform = useCallback(async (targetPlatform: Platform, setLoading: (loading: boolean) => void) => {
    setLoading(true);
    
    if (targetPlatform === "wahyu") { // Hanya "wahyu" yang tidak memiliki pengecekan stok eksternal
      setStock(prevStock => 
        prevStock.map(s => 
          s.platform === targetPlatform ? { ...s, external: 'N/A' } : s
        )
      );
      setLoading(false);
      return;
    }

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

  const fetchExternalStockItemkuSteam = useCallback(() => {
    fetchExternalStockForPlatform("Itemku Steam Game Key", setLoadingExternalItemkuSteam);
  }, [fetchExternalStockForPlatform]);

  useEffect(() => {
    fetchInternalStock();
  }, []);

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Stok Voucher Tersedia</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loadingInternal
            ? visiblePlatformOptions.map((p) => ( // Use visiblePlatformOptions here
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
            : visiblePlatformOptions.map((platform) => ( // Use visiblePlatformOptions here
                <Card key={platform}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{platform}</CardTitle>
                    {platform === "LG" && (
                      <Button 
                        onClick={fetchExternalStockLG} 
                        disabled={loadingExternalLG}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-xs"
                      >
                        {loadingExternalLG ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Refresh
                      </Button>
                    )}
                    {platform === "Itemku" && (
                      <Button 
                        onClick={fetchExternalStockItemku} 
                        disabled={loadingExternalItemku}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-xs"
                      >
                        {loadingExternalItemku ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Refresh
                      </Button>
                    )}
                    {platform === "Itemku Steam Game Key" && (
                      <Button 
                        onClick={fetchExternalStockItemkuSteam} 
                        disabled={loadingExternalItemkuSteam}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-xs"
                      >
                        {loadingExternalItemkuSteam ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Refresh
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {stock
                      .filter(item => item.platform === platform)
                      .sort((a, b) => {
                        const nominalA = a.nominal;
                        const nominalB = b.nominal;
                        const numA = parseInt(nominalA, 10);
                        const numB = parseInt(nominalB, 10);

                        if (!isNaN(numA) && !isNaN(numB)) {
                          return numA - numB;
                        }
                        if (!isNaN(numA)) return -1;
                        if (!isNaN(numB)) return 1;
                        return nominalA.localeCompare(nominalB);
                      })
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
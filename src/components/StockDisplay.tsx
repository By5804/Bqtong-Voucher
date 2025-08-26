"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types"; // Import Database type

type Platform = Database['public']['Tables']['vouchers']['Row']['platform']; // Menggunakan tipe dari Database
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"]; // Menambahkan platform baru
const ALL_NOMINAL_OPTIONS_STR = ["100", "200", "400", "50000", "65000", "100000", "200000", "300000", "500000", "Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];

const formatNominalDisplay = (nominal: string | number) => {
  const strNominal = String(nominal);
  if (strNominal === "100") return "100 RBX";
  if (strNominal === "200") return "200 RBX";
  if (strNominal === "400") return "400 RBX";
  if (strNominal.includes("Random Steam Key")) return strNominal;

  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return (numNominal / 1000).toLocaleString('id-ID') + 'K';
  }
  return strNominal;
};

type StockData = {
  platform: Platform;
  nominal: string; // Diubah dari number menjadi string
  internal: number;
  external: number | 'N/A' | 'loading' | null;
};

// Helper function for nominals based on platform
const getNominalsForPlatform = (currentPlatform: Platform) => {
  if (currentPlatform === "Itemku") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => !n.includes("Random Steam Key"));
  } else if (currentPlatform === "LG" || currentPlatform === "wahyu") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => ["50000", "65000", "200000"].includes(n));
  } else if (currentPlatform === "Itemku Steam Game Key") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => n.includes("Random Steam Key"));
  }
  return []; 
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalLG, setLoadingExternalLG] = useState(false);
  const [loadingExternalItemku, setLoadingExternalItemku] = useState(false);
  const [loadingExternalItemkuSteam, setLoadingExternalItemkuSteam] = useState(false); // New loading state for Itemku Steam
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
          .eq("nominal", nominal) // Nominal sekarang string
          .eq("status", "available")
          .then(({ count }) => ({ platform, nominal, internal: count || 0 }));
        initialStockPromises.push(promise);
      }
    }
    const internalResults = await Promise.all(initialStockPromises);
    
    const initialData = internalResults.map(item => ({ 
      ...item, 
      // Initialize external stock to 'N/A' for 'wahyu' and 'Itemku Steam Game Key', null for LG/Itemku (to be fetched)
      external: item.platform === "wahyu" || item.platform === "Itemku Steam Game Key" ? 'N/A' : (item.platform === "Itemku" || item.platform === "LG") ? null : 'N/A' as const 
    }));
    setStock(initialData);
    setLoadingInternal(false);
  };

  // Fungsi umum untuk mengambil stok eksternal untuk platform tertentu
  const fetchExternalStockForPlatform = useCallback(async (targetPlatform: Platform, setLoading: (loading: boolean) => void) => {
    setLoading(true);
    
    // If platform is 'wahyu' or 'Itemku Steam Game Key', set external stock to 'N/A' immediately
    if (targetPlatform === "wahyu" || targetPlatform === "Itemku Steam Game Key") {
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
            body: { platform: item.platform, nominal: item.nominal }, // Nominal sekarang string
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
        
        <div className="flex justify-center mb-6 gap-4 flex-wrap">
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
          <Button 
            onClick={fetchExternalStockItemkuSteam} 
            disabled={loadingExternalItemkuSteam}
            className="flex items-center gap-2"
          >
            {loadingExternalItemkuSteam ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Memuat Stok Itemku Steam...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> Refresh Stok Itemku Steam
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
                      .sort((a, b) => {
                        // Custom sort for nominals: numeric first, then alphabetical for strings
                        const nominalA = a.nominal;
                        const nominalB = b.nominal;
                        const numA = parseInt(nominalA, 10);
                        const numB = parseInt(nominalB, 10);

                        if (!isNaN(numA) && !isNaN(numB)) {
                          return numA - numB; // Both are numbers, sort numerically
                        }
                        if (!isNaN(numA)) return -1; // A is number, B is string, A comes first
                        if (!isNaN(numB)) return 1;  // B is number, A is string, B comes first
                        return nominalA.localeCompare(nominalB); // Both are strings, sort alphabetically
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
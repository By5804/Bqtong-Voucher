"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, RefreshCw } from "lucide-react";
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
  const [loadingExternal, setLoadingExternal] = useState(false);
  const { toast } = useToast();

  // Fungsi untuk mengambil stok internal (berjalan otomatis saat mount)
  const fetchInternalStock = async () => {
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
    
    const initialData = internalResults.map(item => ({ 
      ...item, 
      external: (item.platform === "Itemku" || item.platform === "LG") ? null : 'N/A' as const 
    }));
    setStock(initialData);
    setLoadingInternal(false);
  };

  // Fungsi untuk mengambil stok eksternal (dipicu oleh tombol)
  const fetchExternalStock = async () => {
    setLoadingExternal(true);
    
    setStock(prevStock => 
      prevStock.map(s => 
        (s.platform === "Itemku" || s.platform === "LG") ? { ...s, external: 'loading' } : s
      )
    );

    const platformsToScrape: Platform[] = ["Itemku", "LG"];
    const externalStockPromises = stock
      .filter(item => platformsToScrape.includes(item.platform))
      .map(async (item) => {
        try {
          const { data, error } = await supabase.functions.invoke('check-external-stock', {
            body: { platform: item.platform, nominal: item.nominal },
          });
          if (error) {
            let errorMessage = error.message;
            // Try to parse a more specific error from the Edge Function's response body
            // Supabase functions.invoke error structure can be tricky.
            // It might be in error.context.errors[0].message or error.data.error
            if (error.context && error.context.errors && error.context.errors.length > 0) {
                try {
                    const parsedEdgeError = JSON.parse(error.context.errors[0].message);
                    if (parsedEdgeError.error) {
                        errorMessage = parsedEdgeError.error;
                    }
                } catch (e) {
                    // Fallback to original message if parsing fails
                }
            } else if (error.data && typeof error.data === 'object' && 'error' in error.data) {
                errorMessage = (error.data as { error: string }).error;
            } else if (typeof error.message === 'string') {
                try {
                    const parsedMessage = JSON.parse(error.message);
                    if (parsedMessage.error) {
                        errorMessage = parsedMessage.error;
                    }
                } catch (e) {
                    // Not a JSON string, use as is
                }
            }
            
            toast({
              title: `Error Stok Eksternal (${item.platform} - ${formatNominalDisplay(item.nominal)})`,
              description: errorMessage,
              variant: "destructive",
            });
            // No need to throw here, as we are handling it with toast
            // throw new Error(errorMessage); // Removed this line
          }
          return { ...item, external: data.stock };
        } catch (err) {
          console.error(`Gagal mengambil stok eksternal untuk ${item.platform} ${item.nominal}:`, err);
          // This catch block handles errors that occur *before* the invoke call or if the invoke call itself fails in an unexpected way
          // The error from invoke is handled in the if (error) block above.
          toast({
            title: `Error Stok Eksternal (${item.platform} - ${formatNominalDisplay(item.nominal)})`,
            description: `Terjadi kesalahan tak terduga: ${err instanceof Error ? err.message : String(err)}`,
            variant: "destructive",
          });
          return { ...item, external: 'N/A' as const };
        }
      });

    for (const promise of externalStockPromises) {
        const result = await promise;
        setStock(prevStock => 
            prevStock.map(s => 
                s.platform === result.platform && s.nominal === result.nominal ? result : s
            )
        );
    }
    setLoadingExternal(false);
  };

  useEffect(() => {
    fetchInternalStock();
  }, []);

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Stok Voucher Tersedia</h2>
        
        <div className="flex justify-center mb-6">
          <Button 
            onClick={fetchExternalStock} 
            disabled={loadingExternal}
            className="flex items-center gap-2"
          >
            {loadingExternal ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Memuat Stok Eksternal...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" /> Refresh Stok Eksternal
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
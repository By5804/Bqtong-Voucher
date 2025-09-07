"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useDenominations } from "@/contexts/DenominationContext";
import { formatNominalDisplay } from "@/lib/utils";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

type StockData = {
  platform: Platform;
  nominal: string;
  internal: number;
  external: number | 'N/A' | 'loading' | null;
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalStates, setLoadingExternalStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();

  const visiblePlatforms = useMemo(() => 
    denominationPlatforms.filter(p => p.platform_name !== "wahyu"),
    [denominationPlatforms]
  );

  const fetchInternalStock = useCallback(async () => {
    if (loadingDenominations || visiblePlatforms.length === 0) {
      if (!loadingDenominations) setLoadingInternal(false);
      return;
    }

    setLoadingInternal(true);
    const stockPromises: Promise<StockData>[] = [];

    for (const platform of visiblePlatforms) {
      for (const nominal of platform.denominations) {
        const promise = supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform.platform_name)
          .eq("nominal", nominal)
          .eq("status", "available")
          .then(({ count }) => ({
            platform: platform.platform_name as Platform,
            nominal,
            internal: count || 0,
            external: (platform.platform_name === "Itemku" || platform.platform_name === "LG" || platform.platform_name === "Itemku Steam Game Key" || platform.platform_name.toLowerCase().includes('valorant')) ? null : 'N/A' as const
          }));
        stockPromises.push(promise);
      }
    }
    
    const results = await Promise.all(stockPromises);
    setStock(results);
    setLoadingInternal(false);
  }, [loadingDenominations, visiblePlatforms]);

  useEffect(() => {
    fetchInternalStock();
  }, [fetchInternalStock]);

  const fetchExternalStockForPlatform = useCallback(async (targetPlatform: Platform) => {
    setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: true }));

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

          if (error) {
            toast({ title: "Error", description: `Gagal memuat stok eksternal untuk ${item.platform} ${formatNominalDisplay(item.nominal, item.platform)}: ${error.message}`, variant: "destructive" });
            return { ...item, external: 'N/A' as const };
          }
          return { ...item, external: data.stock };
        } catch (err: any) {
          toast({ title: "Error", description: `Terjadi kesalahan saat memuat stok eksternal untuk ${item.platform} ${formatNominalDisplay(item.nominal, item.platform)}: ${err.message}`, variant: "destructive" });
          return { ...item, external: 'N/A' as const };
        }
    });

    const results = await Promise.all(externalStockPromises);
    setStock(prevStock => {
        const newStock = [...prevStock];
        results.forEach(updatedItem => {
          const index = newStock.findIndex(s => s.platform === updatedItem.platform && s.nominal === updatedItem.nominal);
          if (index !== -1) {
            newStock[index] = updatedItem;
          }
        });
        return newStock;
    });

    setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: false }));
  }, [stock, toast]);

  const isLoading = loadingInternal || loadingDenominations;

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Stok Voucher Tersedia</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={`skel-${i}`}>
                  <CardHeader><CardTitle><Skeleton className="h-6 w-24" /></CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={`skel-item-${j}`} className="flex justify-between items-center">
                        <span><Skeleton className="h-4 w-16" /></span>
                        <span><Skeleton className="h-4 w-8" /></span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            : visiblePlatforms.map((platform) => (
                <Card key={platform.platform_name}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{platform.platform_name}</CardTitle>
                    {(platform.platform_name === "LG" || platform.platform_name === "Itemku" || platform.platform_name === "Itemku Steam Game Key" || platform.platform_name.toLowerCase().includes('valorant')) && (
                      <Button 
                        onClick={() => fetchExternalStockForPlatform(platform.platform_name as Platform)} 
                        disabled={loadingExternalStates[platform.platform_name]}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-xs"
                      >
                        {loadingExternalStates[platform.platform_name] ? (
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
                      .filter(item => item.platform === platform.platform_name)
                      .sort((a, b) => {
                        const numA = parseInt(a.nominal, 10);
                        const numB = parseInt(b.nominal, 10);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        if (!isNaN(numA)) return -1;
                        if (!isNaN(numB)) return 1;
                        return a.nominal.localeCompare(b.nominal);
                      })
                      .map(({ nominal, internal, external }) => (
                        <div key={`${platform.platform_name}-${nominal}`} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            {formatNominalDisplay(nominal, platform.platform_name)}
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
                                <p>Stok di Platform Eksternal</p>
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
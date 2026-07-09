"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useDenominations, PlatformDenomination } from "@/contexts/DenominationContext";
import { formatNominalDisplay, cn } from "@/lib/utils";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

type StockData = {
  platform: Platform;
  nominal: string;
  internal: number;
  external: number | 'N/A' | 'loading' | null;
  isOnHold: boolean;
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalStates, setLoadingExternalStates] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();

  const visiblePlatforms = useMemo(() => 
    denominationPlatforms.filter(p => p.is_visible_on_dashboard),
    [denominationPlatforms]
  );

  const fetchExternalStockForPlatform = useCallback(async (targetPlatform: Platform) => {
    setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: true }));

    setStock(prevStock => 
      prevStock.map(s => 
        s.platform === targetPlatform && s.external !== 'N/A' ? { ...s, external: 'loading' } : s
      )
    );

    const platformInfo = (denominationPlatforms as PlatformDenomination[]).find(p => p.platform_name === targetPlatform);
    if (!platformInfo || !platformInfo.is_external_stock_enabled) {
        setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: false }));
        return;
    }

    // Filter out denominations that are currently on hold
    const activeDenominations = platformInfo.denominations.filter(
      nominal => !(platformInfo.on_hold_denominations || []).includes(nominal)
    );

    const externalStockPromises = activeDenominations.map(async (nominal) => {
        try {
          const { data, error } = await supabase.functions.invoke('check-external-stock', {
            body: { platform: targetPlatform, nominal: nominal },
          });

          if (error) {
            console.error("External stock fetch error:", error);
            return { platform: targetPlatform, nominal, external: 0 }; // Default ke 0 jika error
          }
          return { platform: targetPlatform, nominal, external: data.stock };
        } catch (err: any) {
          console.error("External stock catch error:", err);
          return { platform: targetPlatform, nominal, external: 0 };
        }
    });

    const results = await Promise.all(externalStockPromises);

    setStock(prevStock => {
        const newStock = [...prevStock];
        results.forEach(updatedItem => {
          const index = newStock.findIndex(s => s.platform === updatedItem.platform && s.nominal === updatedItem.nominal);
          if (index !== -1) {
            newStock[index].external = updatedItem.external;
          }
        });
        return newStock;
    });

    setLoadingExternalStates(prev => ({ ...prev, [targetPlatform]: false }));
  }, [denominationPlatforms]);

  const fetchInternalStock = useCallback(async () => {
    if (loadingDenominations || visiblePlatforms.length === 0) {
      if (!loadingDenominations) setLoadingInternal(false);
      return;
    }

    setLoadingInternal(true);
    const stockPromises: Promise<StockData>[] = [];

    for (const platform of visiblePlatforms) {
      for (const nominal of platform.denominations) {
        const isOnHold = (platform.on_hold_denominations || []).includes(nominal);
        
        // Lewati produk on-hold agar tidak muncul di dashboard utama
        if (isOnHold) continue;
        
        const fetchItem = async (): Promise<StockData> => {
          const { count } = await supabase
            .from("vouchers")
            .select("*", { count: "exact", head: true })
            .eq("platform", platform.platform_name)
            .eq("nominal", nominal)
            .eq("status", "available");
          
          return {
            platform: platform.platform_name as Platform,
            nominal,
            internal: count || 0,
            external: platform.is_external_stock_enabled ? null : 0,
            isOnHold
          };
        };
        
        stockPromises.push(fetchItem());
      }
    }
    
    const results = await Promise.all(stockPromises);
    setStock(results);
    setLoadingInternal(false);

    const platformsToRefresh = visiblePlatforms
      .filter(p => p.is_external_stock_enabled)
      .map(p => p.platform_name as Platform);
    
    platformsToRefresh.forEach(platform => {
        fetchExternalStockForPlatform(platform);
    });

  }, [loadingDenominations, visiblePlatforms, fetchExternalStockForPlatform]);

  useEffect(() => {
    fetchInternalStock();
  }, [fetchInternalStock]);

  const isLoading = loadingInternal || loadingDenominations;

  const renderStockItem = (item: StockData, platformName: string) => {
    const { nominal, internal, external } = item;
    
    const extVal = external === null || external === 'loading' ? 0 : Number(external);
    const isRed = internal === 0 && extVal === 0;
    const isGreen = internal === 0 && extVal > 0;

    return (
      <div 
        key={`${platformName}-${nominal}`} 
        className={cn(
          "flex justify-between items-center py-2 px-3 rounded-md mb-1.5 transition-colors",
          isRed && "bg-red-50/80 text-red-700",
          isGreen && "bg-green-50/80 text-green-700",
          !isRed && !isGreen && "text-slate-700 hover:bg-slate-50"
        )}
      >
        <span className={cn(
          "text-[14px] font-semibold",
          isRed && "text-red-600",
          isGreen && "text-green-600",
          !isRed && !isGreen && "text-slate-600"
        )}>
          {formatNominalDisplay(nominal, platformName)}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Ext:</span>
          {external === 'loading' ? (
            <Skeleton className="h-4 w-6 inline-block" />
          ) : (
            <span className={cn(
              "font-bold text-sm",
              isRed ? "text-red-600" : (isGreen ? "text-green-600" : "text-slate-800")
            )}>
              {external === null ? 0 : external}
            </span>
          )}
          <span className="text-gray-300">|</span>
          <span>Int:</span>
          <span className={cn(
            "font-extrabold text-[15px]",
            isRed ? "text-red-700" : (isGreen ? "text-green-700" : "text-black")
          )}>
            {internal}
          </span>
        </div>
      </div>
    );
  };

  const sortStock = (a: StockData, b: StockData) => {
    const numA = parseInt(a.nominal, 10);
    const numB = parseInt(b.nominal, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.nominal.localeCompare(b.nominal);
  };

  return (
    <div className="w-full max-w-7xl px-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={`skel-${i}`} className="border border-slate-100">
                <CardHeader className="pb-3"><CardTitle><Skeleton className="h-6 w-24" /></CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={`skel-item-${j}`} className="flex justify-between items-center">
                      <span><Skeleton className="h-4 w-24" /></span>
                      <span><Skeleton className="h-4 w-12" /></span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          : visiblePlatforms.map((platform) => {
              const platformStock = stock.filter(item => item.platform === platform.platform_name);
              
              return (
                <Card key={platform.platform_name} className="border border-slate-100 shadow-sm bg-white rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-50">
                    <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {platform.platform_name.toUpperCase()}
                    </CardTitle>
                    {platform.is_external_stock_enabled && (
                      <Button 
                        onClick={() => fetchExternalStockForPlatform(platform.platform_name as Platform)} 
                        disabled={loadingExternalStates[platform.platform_name]}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold border-slate-200 shadow-sm hover:bg-slate-50"
                      >
                        <RefreshCw className={cn("h-3 w-3", loadingExternalStates[platform.platform_name] && "animate-spin")} />
                        Refresh
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4 space-y-1">
                    {platformStock.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400 italic">Tidak ada produk aktif</div>
                    ) : (
                      platformStock
                        .sort(sortStock)
                        .map(item => renderStockItem(item, platform.platform_name))
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
};
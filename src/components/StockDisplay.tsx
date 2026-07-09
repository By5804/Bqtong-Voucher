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
import { useDenominations, PlatformDenomination } from "@/contexts/DenominationContext";
import { formatNominalDisplay, cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";

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
  const [sortBy, setSortBy] = useState<'nominal' | 'internal' | 'external'>('nominal');

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
            toast({ title: "Error", description: `Gagal memuat stok eksternal untuk ${targetPlatform} ${formatNominalDisplay(nominal, targetPlatform)}: ${error.message}`, variant: "destructive" });
            return { platform: targetPlatform, nominal, external: 'N/A' as const };
          }
          return { platform: targetPlatform, nominal, external: data.stock };
        } catch (err: any) {
          toast({ title: "Error", description: `Terjadi kesalahan saat memuat stok eksternal untuk ${targetPlatform} ${formatNominalDisplay(nominal, targetPlatform)}: ${err.message}`, variant: "destructive" });
          return { platform: targetPlatform, nominal, external: 'N/A' as const };
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
  }, [denominationPlatforms, toast]);

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
        
        // Skip on-hold products entirely from the dashboard main display
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
            external: platform.is_external_stock_enabled ? null : 'N/A' as const,
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
    const isOutOfStock = external != null && external !== 'loading' && external !== 'N/A' && Number(external) === 0;
    const isLowStock = external != null && external !== 'loading' && external !== 'N/A' && Number(external) > 0 && Number(external) < 5;
    
    return (
      <div key={`${platformName}-${nominal}`} className={cn(
        "flex justify-between items-center p-1.5 rounded-md",
        isOutOfStock ? "bg-red-50/70" : (isLowStock ? "bg-green-50/70" : "")
      )}>
        <span className={cn(
          "text-sm font-medium",
          isOutOfStock ? "text-red-700" : (isLowStock ? "text-green-700" : "text-muted-foreground")
        )}>
          {formatNominalDisplay(nominal, platformName)}
        </span>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Ext:</span>
              {external === null ? (
                <span className="text-sm text-muted-foreground">...</span>
              ) : external === 'loading' ? (
                <Skeleton className="h-4 w-6" />
              ) : (
                <span className={cn(
                  "font-semibold text-sm",
                  isOutOfStock ? "text-red-700" : (isLowStock ? "text-green-700" : "")
                )}>{external}</span>
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
              <span className={cn(
                "text-lg font-bold",
                isOutOfStock ? "text-red-700" : (isLowStock ? "text-green-700" : "")
              )}>{internal}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Stok di Database Internal Anda</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  const sortStock = (a: StockData, b: StockData) => {
    if (sortBy === 'internal') return b.internal - a.internal;
    if (sortBy === 'external') {
      const extA = (typeof a.external === 'number') ? a.external : -1;
      const extB = (typeof b.external === 'number') ? b.external : -1;
      return extB - extA;
    }
    const numA = parseInt(a.nominal, 10);
    const numB = parseInt(b.nominal, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.nominal.localeCompare(b.nominal);
  };

  return (
    <TooltipProvider>
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-4">
              <h2 className="text-2xl font-bold text-center">Stok Voucher Tersedia</h2>
              <div className="flex items-center gap-2">
                  <Label htmlFor="sort-toggle" className="text-sm font-medium">Urutkan per:</Label>
                  <ToggleGroup
                      id="sort-toggle"
                      type="single"
                      value={sortBy}
                      onValueChange={(value) => { if (value) setSortBy(value as any); }}
                      className="my-auto"
                  >
                      <ToggleGroupItem value="nominal" aria-label="Sort by nominal">Nominal</ToggleGroupItem>
                      <ToggleGroupItem value="internal" aria-label="Sort by internal stock">Stok Int</ToggleGroupItem>
                      <ToggleGroupItem value="external" aria-label="Sort by external stock">Stok Ext</ToggleGroupItem>
                  </ToggleGroup>
              </div>
          </div>
          
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
              : visiblePlatforms.map((platform) => {
                  const platformStock = stock.filter(item => item.platform === platform.platform_name);
                  if (platformStock.length === 0) return null;
                  
                  return (
                    <Card key={platform.platform_name}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-medium">{platform.platform_name}</CardTitle>
                        {platform.is_external_stock_enabled && (
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
                      <CardContent className="space-y-1">
                        {platformStock
                          .sort(sortStock)
                          .map(item => renderStockItem(item, platform.platform_name))}
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
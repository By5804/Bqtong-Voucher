"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ShieldAlert, BadgeAlert, Layers, CheckCircle2 } from "lucide-react";
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

    const onHoldSet = new Set(platformInfo.on_hold_denominations || []);
    const activeDenominations = platformInfo.denominations.filter(d => !onHoldSet.has(d));

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
      const onHoldSet = new Set(platform.on_hold_denominations || []);
      const activeDenominations = platform.denominations.filter(nominal => !onHoldSet.has(nominal));

      for (const nominal of activeDenominations) {
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
            isOnHold: false
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
    const displayName = formatNominalDisplay(nominal, platformName);

    return (
      <div 
        key={`${platformName}-${nominal}`} 
        className={cn(
          "flex items-center justify-between py-1.5 px-2 rounded-lg border border-transparent transition-all hover:bg-slate-55/60 dark:hover:bg-slate-800/50",
          isOutOfStock 
            ? "bg-red-50/40 dark:bg-red-950/10 border-red-100/30" 
            : isLowStock 
              ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-100/30" 
              : ""
        )}
      >
        {/* Left Section: Name with Tooltip on Overflow */}
        <div className="flex-1 min-w-0 pr-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "block text-[11px] font-semibold truncate cursor-help text-left select-none",
                isOutOfStock 
                  ? "text-red-700 dark:text-red-400" 
                  : isLowStock 
                    ? "text-amber-700 dark:text-amber-400" 
                    : "text-slate-700 dark:text-slate-300"
              )}>
                {displayName}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] break-words text-xs">
              {displayName}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right Section: Perfectly Aligned Compact Badge */}
        <div className="flex items-center shrink-0">
          <div className={cn(
            "flex items-center divide-x divide-slate-200 dark:divide-slate-700/50 rounded-md border text-[10px] font-mono shadow-sm bg-white dark:bg-slate-900",
            isOutOfStock 
              ? "border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400" 
              : isLowStock 
                ? "border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400" 
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          )}>
            {/* EXT STOCK */}
            <div className="flex items-center justify-center w-[48px] py-0.5 gap-0.5">
              <span className="text-[8px] opacity-60 uppercase font-sans font-medium">Ext</span>
              <span className="font-bold">
                {external === null ? (
                  <span className="animate-pulse">...</span>
                ) : external === 'loading' ? (
                  <RefreshCw className="h-2 w-2 animate-spin inline-block text-indigo-500" />
                ) : (
                  external
                )}
              </span>
            </div>

            {/* INT STOCK */}
            <div className={cn(
              "flex items-center justify-center w-[48px] py-0.5 gap-0.5",
              isOutOfStock 
                ? "bg-red-50 dark:bg-red-950/20 font-extrabold text-red-600" 
                : isLowStock 
                  ? "bg-amber-50 dark:bg-amber-950/20 font-extrabold text-amber-600" 
                  : "bg-emerald-50/50 dark:bg-emerald-950/10 font-bold text-emerald-600 dark:text-emerald-400"
            )}>
              <span className="text-[8px] opacity-60 uppercase font-sans font-medium">Int</span>
              <span>{internal}</span>
            </div>
          </div>
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
      <div className="w-full space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Stok Monitor Real-time 
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Menampilkan stok internal database & eksternal live.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="sort-toggle" className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Urutan:</Label>
            <ToggleGroup
              id="sort-toggle"
              type="single"
              value={sortBy}
              onValueChange={(value) => { if (value) setSortBy(value as any); }}
              className="bg-slate-50 dark:bg-slate-850 p-1 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              <ToggleGroupItem value="nominal" className="text-xs px-3 py-1.5 rounded-lg data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm">Nominal</ToggleGroupItem>
              <ToggleGroupItem value="internal" className="text-xs px-3 py-1.5 rounded-lg data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm">Stok Int</ToggleGroupItem>
              <ToggleGroupItem value="external" className="text-xs px-3 py-1.5 rounded-lg data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm">Stok Ext</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
          
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={`skel-${i}`} className="border-none shadow-sm bg-slate-50 dark:bg-slate-900 animate-pulse">
                  <CardHeader className="pb-3"><Skeleton className="h-6 w-24 rounded-md" /></CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={`skel-item-${j}`} className="flex justify-between items-center">
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-5 w-12 rounded-md" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            : visiblePlatforms.map((platform) => {
                const platformStock = stock.filter(item => item.platform === platform.platform_name);
                if (platformStock.length === 0) return null;
                
                const hasCriticalStock = platformStock.some(item => {
                  return item.external != null && item.external !== 'loading' && item.external !== 'N/A' && Number(item.external) === 0;
                });
                const hasLowStock = platformStock.some(item => {
                  return item.external != null && item.external !== 'loading' && item.external !== 'N/A' && Number(item.external) > 0 && Number(item.external) < 5;
                });

                return (
                  <Card 
                    key={platform.platform_name}
                    className={cn(
                      "group border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] transition-all duration-300 hover:translate-y-[-2px] bg-white dark:bg-slate-900 overflow-hidden relative",
                      hasCriticalStock 
                        ? "ring-1 ring-red-500/20 hover:ring-red-500/40" 
                        : hasLowStock 
                          ? "ring-1 ring-amber-500/20 hover:ring-amber-500/40"
                          : "ring-1 ring-slate-100 dark:ring-slate-800 hover:ring-indigo-500/20"
                    )}
                  >
                    <div className={cn(
                      "h-1.5 w-full absolute top-0 left-0",
                      hasCriticalStock 
                        ? "bg-gradient-to-r from-red-500 to-rose-600" 
                        : hasLowStock 
                          ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                          : "bg-gradient-to-r from-indigo-500 to-purple-600"
                    )} />

                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5">
                      <CardTitle className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        {platform.platform_name}
                        {hasCriticalStock ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                        ) : hasLowStock ? (
                          <BadgeAlert className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </CardTitle>
                      {platform.is_external_stock_enabled && (
                        <Button 
                          onClick={() => fetchExternalStockForPlatform(platform.platform_name as Platform)} 
                          disabled={loadingExternalStates[platform.platform_name]}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-full"
                        >
                          <RefreshCw className={cn("h-3 w-3", loadingExternalStates[platform.platform_name] && "animate-spin text-indigo-500")} />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-1.5 pb-5 px-3">
                      {platformStock
                        .sort(sortStock)
                        .map(item => renderStockItem(item, platform.platform_name))}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>
    </TooltipProvider>
  );
};
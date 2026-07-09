"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ShieldAlert, BadgeAlert, Layers, CheckCircle2, Check, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useDenominations, PlatformDenomination } from "@/contexts/DenominationContext";
import { formatNominalDisplay, cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const [syncingStates, setSyncingStates] = useState<Record<string, boolean>>({});
  const [syncingPlatforms, setSyncingPlatforms] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();
  const [sortBy, setSortBy] = useState<'nominal' | 'internal' | 'external'>('nominal');

  // Manual sale modal state (for N/A items)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedManualItem, setSelectedManualItem] = useState<{ platform: Platform; nominal: string; internal: number } | null>(null);
  const [manualQuantity, setManualQuantity] = useState(1);
  const [submittingManual, setSubmittingManual] = useState(false);

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

  // Function to sync individual item stock
  const handleSyncIndividualItem = async (platform: Platform, nominal: string, internal: number, external: number) => {
    const diff = internal - external;
    if (diff <= 0) return;

    const key = `${platform}-${nominal}`;
    setSyncingStates(prev => ({ ...prev, [key]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('mark-vouchers-sold', {
        body: { platform, nominal, quantity: diff },
      });

      if (error) {
        toast({ title: "Gagal Sinkronisasi", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Sinkronisasi Berhasil", description: `${diff} voucher pada ${platform} - ${formatNominalDisplay(nominal, platform)} berhasil ditandai terjual.` });
        fetchInternalStock();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  // New function to sync an entire platform at once
  const handleSyncEntirePlatform = async (platformName: string) => {
    setSyncingPlatforms(prev => ({ ...prev, [platformName]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('sync-platform-stock', {
        body: { platform: platformName },
      });

      if (error) {
        toast({ title: "Gagal Sinkronisasi Kategori", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Sukses Sinkronisasi Kategori", description: data.message });
        fetchInternalStock();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncingPlatforms(prev => ({ ...prev, [platformName]: false }));
    }
  };

  const openManualSale = (platform: Platform, nominal: string, internal: number) => {
    setSelectedManualItem({ platform, nominal, internal });
    setManualQuantity(1);
    setIsManualModalOpen(true);
  };

  const submitManualSale = async () => {
    if (!selectedManualItem) return;
    if (manualQuantity <= 0) {
      toast({ title: "Error", description: "Jumlah harus lebih dari 0", variant: "destructive" });
      return;
    }
    if (manualQuantity > selectedManualItem.internal) {
      toast({ title: "Error", description: "Jumlah penjualan melebihi stok internal yang tersedia", variant: "destructive" });
      return;
    }

    setSubmittingManual(true);
    try {
      const { error } = await supabase.functions.invoke('mark-vouchers-sold', {
        body: { 
          platform: selectedManualItem.platform, 
          nominal: selectedManualItem.nominal, 
          quantity: manualQuantity 
        },
      });

      if (error) {
        toast({ title: "Gagal", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Sukses", description: `${manualQuantity} voucher berhasil ditandai terjual.` });
        setIsManualModalOpen(false);
        fetchInternalStock();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingManual(false);
    }
  };

  const renderStockItem = (item: StockData, platformName: string, isLast: boolean) => {
    const { nominal, internal, external } = item;
    const itemKey = `${platformName}-${nominal}`;
    
    const isOutOfStock = (external === null || external === 'N/A' || Number(external) === 0) && internal === 0;
    const isLowStock = external != null && external !== 'loading' && external !== 'N/A' && Number(external) > 0 && Number(external) < 5;
    const hasActiveStock = (internal > 0 || (typeof external === 'number' && external > 0)) && !isLowStock;

    const isExternalValidNumber = typeof external === 'number';
    const canSync = isExternalValidNumber && internal > external;
    const isSynced = isExternalValidNumber && internal === external;
    const isSyncing = !!syncingStates[itemKey];

    const displayName = formatNominalDisplay(nominal, platformName);

    return (
      <div 
        key={itemKey} 
        className={cn(
          "flex items-center justify-between py-2.5 px-3 transition-all",
          !isLast && "border-b border-slate-100/80 dark:border-slate-800/40",
          isLowStock
            ? "bg-amber-50/80 dark:bg-amber-955/20 hover:bg-amber-100/80 border-l-4 border-l-amber-500 pl-2"
            : hasActiveStock 
              ? "bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20" 
              : isOutOfStock 
                ? "bg-red-50/20 dark:bg-red-950/5 hover:bg-red-50/40 dark:hover:bg-red-950/10" 
                : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
        )}
      >
        {/* Left Section: Name with Tooltip on Overflow */}
        <div className="flex-1 min-w-0 pr-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "block text-xs font-bold truncate cursor-help text-left select-none tracking-tight",
                isLowStock
                  ? "text-amber-800 dark:text-amber-300"
                  : hasActiveStock 
                    ? "text-emerald-800 dark:text-emerald-400" 
                    : isOutOfStock 
                      ? "text-red-700/80 dark:text-red-400/80 font-semibold" 
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

        {/* Right Section: Compact stock badge and Action button */}
        <div className="flex items-center shrink-0 py-0.5 gap-2">
          {/* Stock Capsules */}
          <div className={cn(
            "flex items-center divide-x divide-slate-200/80 dark:divide-slate-700/50 rounded-lg border text-xs font-mono shadow-sm bg-white dark:bg-slate-900",
            isLowStock
              ? "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400"
              : hasActiveStock 
                ? "border-emerald-200 dark:border-emerald-900/40" 
                : isOutOfStock 
                  ? "border-red-100 dark:border-red-900/20 text-red-700/60 dark:text-red-400/60" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          )}>
            {/* EXT STOCK (Fixed size for alignment) */}
            <div className={cn(
              "flex items-center justify-center w-[54px] py-1 gap-1",
              isLowStock && "bg-amber-500/10"
            )}>
              <span className="text-[9px] font-extrabold uppercase tracking-tight text-slate-400 dark:text-slate-500">EXT</span>
              <span className={cn("font-extrabold", isLowStock && "text-amber-600 dark:text-amber-400 animate-pulse")}>
                {external === null ? (
                  <span className="animate-pulse">...</span>
                ) : external === 'loading' ? (
                  <RefreshCw className="h-2.5 w-2.5 animate-spin inline-block text-indigo-500" />
                ) : (
                  external
                )}
              </span>
            </div>

            {/* INT STOCK (Fixed size for alignment) */}
            <div className={cn(
              "flex items-center justify-center w-[54px] py-1 gap-1 rounded-r-lg",
              isLowStock
                ? "bg-amber-500/20 font-black text-amber-700 dark:text-amber-300"
                : hasActiveStock 
                  ? "bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-400" 
                  : isOutOfStock 
                    ? "bg-red-500/5 font-bold text-red-600/60 dark:text-red-400/60" 
                    : "bg-slate-50 dark:bg-slate-800"
            )}>
              <span className="text-[9px] font-extrabold uppercase tracking-tight text-slate-400 dark:text-slate-500">INT</span>
              <span className="font-extrabold">{internal}</span>
            </div>
          </div>

          {/* Individual Nominal Action Button */}
          {external === 'N/A' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => openManualSale(platformName as Platform, nominal, internal)}
                  disabled={internal === 0}
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-lg shrink-0 transition-all border shadow-sm",
                    internal > 0 
                      ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900" 
                      : "bg-slate-50 text-slate-300 border-slate-100"
                  )}
                >
                  <Zap className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Tandai Terjual Manual
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleSyncIndividualItem(platformName as Platform, nominal, internal, Number(external))}
                  disabled={!canSync || isSyncing}
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-lg shrink-0 transition-all border shadow-sm",
                    canSync 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:scale-105 active:scale-95" 
                      : isSynced 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 cursor-default" 
                        : "bg-slate-50 text-slate-300 border-slate-100"
                  )}
                >
                  {isSyncing ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : isSynced ? (
                    <Check className="h-3 w-3 font-bold" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                {canSync 
                  ? `Samakan Stok (Tandai ${internal - Number(external)} Terjual)` 
                  : isSynced 
                    ? "Stok Sudah Sesuai" 
                    : "Stok Database Sesuai/Lebih Sedikit"}
              </TooltipContent>
            </Tooltip>
          )}
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
                
                const hasCriticalStock = platformStock.every(item => {
                  return (item.external === null || item.external === 'N/A' || Number(item.external) === 0) && item.internal === 0;
                });
                
                const hasLowStock = platformStock.some(item => {
                  return item.external != null && item.external !== 'loading' && item.external !== 'N/A' && Number(item.external) > 0 && Number(item.external) < 5;
                });

                // Check if ANY item in this entire platform is out of sync (internal > external)
                const canSyncPlatform = platformStock.some(item => {
                  const isExternalValidNumber = typeof item.external === 'number';
                  return isExternalValidNumber && item.internal > item.external;
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

                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5 px-4">
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
                      
                      <div className="flex items-center gap-1">
                        {platform.is_external_stock_enabled && (
                          <>
                            {/* Refresh External Stock Button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  onClick={() => fetchExternalStockForPlatform(platform.platform_name as Platform)} 
                                  disabled={loadingExternalStates[platform.platform_name]}
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-full"
                                >
                                  <RefreshCw className={cn("h-3 w-3", loadingExternalStates[platform.platform_name] && "animate-spin text-indigo-500")} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Refresh Stok Eksternal
                              </TooltipContent>
                            </Tooltip>

                            {/* Sync Entire Category / Platform Button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  onClick={() => handleSyncEntirePlatform(platform.platform_name)} 
                                  disabled={!canSyncPlatform || syncingPlatforms[platform.platform_name]}
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "h-7 w-7 rounded-full transition-all",
                                    canSyncPlatform 
                                      ? "text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 hover:scale-110 active:scale-95" 
                                      : "text-slate-300 dark:text-slate-700 cursor-default"
                                  )}
                                >
                                  {syncingPlatforms[platform.platform_name] ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Zap className={cn("h-3.5 w-3.5", canSyncPlatform ? "fill-indigo-600 animate-pulse" : "")} />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                {canSyncPlatform 
                                  ? "Samakan Stok Semua Nominal di Kategori Ini" 
                                  : "Semua Nominal Kategori Ini Sudah Sesuai"}
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 border-t border-slate-50 dark:border-slate-800/20">
                      <div className="flex flex-col">
                        {platformStock
                          .sort(sortStock)
                          .map((item, index) => renderStockItem(item, platform.platform_name, index === platformStock.length - 1))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* Mini Modal for quick manual sale of N/A stock items */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Tandai Terjual</DialogTitle>
            <DialogDescription>
              Tandai voucher {selectedManualItem && selectedManualItem.platform} - {selectedManualItem && formatNominalDisplay(selectedManualItem.nominal, selectedManualItem.platform)} sebagai terjual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="qty-manual">Jumlah Terjual (FIFO)</Label>
              <Input
                id="qty-manual"
                type="number"
                min="1"
                max={selectedManualItem?.internal || 1}
                value={manualQuantity}
                onChange={e => setManualQuantity(Math.max(1, Math.min(selectedManualItem?.internal || 1, parseInt(e.target.value) || 1)))}
                disabled={submittingManual}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Stok internal tersedia: <span className="font-bold text-slate-700">{selectedManualItem?.internal}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualModalOpen(false)} disabled={submittingManual}>Batal</Button>
            <Button onClick={submitManualSale} disabled={submittingManual}>
              {submittingManual ? "Memproses..." : "Konfirmasi Terjual"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
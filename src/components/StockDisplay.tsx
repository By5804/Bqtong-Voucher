"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ShieldAlert, BadgeAlert, Layers, CheckCircle2, Zap, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useDenominations, PlatformDenomination } from "@/contexts/DenominationContext";
import { formatNominalDisplay, cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

type StockData = {
  platform: Platform;
  nominal: string;
  internal: number;
  external: number | 'N/A' | 'loading' | null;
  isOnHold: boolean;
};

type SyncPreviewItem = {
  nominal: string;
  internal: number;
  external: number;
  diff: number;
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [loadingExternalStates, setLoadingExternalStates] = useState<Record<string, boolean>>({});
  const [syncingPlatforms, setSyncingPlatforms] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();
  const [sortBy, setSortBy] = useState<'nominal' | 'internal' | 'external'>('nominal');

  // Category sync confirmation dialog state
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [platformToSync, setPlatformToSync] = useState<string | null>(null);
  const [syncPreview, setSyncPreview] = useState<SyncPreviewItem[]>([]);

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

  // Open the confirmation sync dialog for an entire platform
  const openSyncPreview = (platformName: string) => {
    const platformStock = stock.filter(item => item.platform === platformName);
    
    const previewItems = platformStock
      .filter(item => {
        const isExternalValidNumber = typeof item.external === 'number';
        return isExternalValidNumber && item.internal > item.external;
      })
      .map(item => ({
        nominal: item.nominal,
        internal: item.internal,
        external: Number(item.external),
        diff: item.internal - Number(item.external)
      }));

    if (previewItems.length === 0) {
      toast({ 
        title: "Info", 
        description: `Stok untuk seluruh kategori ${platformName} sudah sinkron sempurna dengan eksternal.` 
      });
      return;
    }

    setPlatformToSync(platformName);
    setSyncPreview(previewItems);
    setIsSyncDialogOpen(true);
  };

  // Execute actual database sync for the entire platform after user confirms
  const executePlatformSync = async () => {
    if (!platformToSync) return;

    setIsSyncDialogOpen(false);
    setSyncingPlatforms(prev => ({ ...prev, [platformToSync]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-platform-stock', {
        body: { platform: platformToSync },
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
      setSyncingPlatforms(prev => ({ ...prev, [platformToSync]: false }));
      setPlatformToSync(null);
      setSyncPreview([]);
    }
  };

  const renderStockItem = (item: StockData, platformName: string, isLast: boolean) => {
    const { nominal, internal, external } = item;
    const itemKey = `${platformName}-${nominal}`;
    
    // PERBAIKAN: Nominal dianggap Out of Stock (Merah) jika stok eksternal live = 0, atau stok internal local = 0 untuk tipe N/A
    const isOutOfStock = (external !== null && external !== 'loading' && external !== 'N/A' && Number(external) === 0) || 
                         ((external === 'N/A' || external === null) && internal === 0);
                         
    const isLowStock = !isOutOfStock && external != null && external !== 'loading' && external !== 'N/A' && Number(external) > 0 && Number(external) < 5;
    const hasActiveStock = !isOutOfStock && !isLowStock && (internal > 0 || (typeof external === 'number' && external >= 5));

    const displayName = formatNominalDisplay(nominal, platformName);

    return (
      <div 
        key={itemKey} 
        className={cn(
          "flex items-center justify-between py-2.5 px-3 transition-all",
          !isLast && "border-b border-slate-100/80 dark:border-slate-800/40",
          isOutOfStock
            ? "bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50/60 dark:hover:bg-red-950/20 border-l-4 border-l-red-500 pl-2"
            : isLowStock
              ? "bg-amber-50/80 dark:bg-amber-955/20 hover:bg-amber-100/80 border-l-4 border-l-amber-500 pl-2"
              : hasActiveStock 
                ? "bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20" 
                : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
        )}
      >
        {/* Left Section: Name with Tooltip on Overflow */}
        <div className="flex-1 min-w-0 pr-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "block text-xs font-bold truncate cursor-help text-left select-none tracking-tight",
                isOutOfStock
                  ? "text-red-700 dark:text-red-400 font-extrabold"
                  : isLowStock
                    ? "text-amber-800 dark:text-amber-300"
                    : hasActiveStock 
                      ? "text-emerald-800 dark:text-emerald-400" 
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

        {/* Right Section: Compact stock count capsules (No labels, larger text, no individual buttons) */}
        <div className="flex items-center shrink-0 py-0.5">
          <div className={cn(
            "flex items-center divide-x divide-slate-200/80 dark:divide-slate-700/50 rounded-lg border text-sm font-mono shadow-sm bg-white dark:bg-slate-900",
            isOutOfStock
              ? "border-red-400 dark:border-red-800 text-red-700 dark:text-red-400"
              : isLowStock
                ? "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                : hasActiveStock 
                  ? "border-emerald-200 dark:border-emerald-900/40" 
                  : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          )}>
            {/* EXT STOCK */}
            <div className={cn(
              "flex items-center justify-center w-[48px] py-1 text-center",
              isOutOfStock ? "bg-red-500/10" : isLowStock ? "bg-amber-500/10" : ""
            )}>
              <span className={cn("text-sm font-bold", isOutOfStock && "text-red-600 dark:text-red-400 animate-pulse")}>
                {external === null ? (
                  <span className="animate-pulse">...</span>
                ) : external === 'loading' ? (
                  <RefreshCw className="h-3 w-3 animate-spin inline-block text-indigo-500" />
                ) : (
                  external
                )}
              </span>
            </div>

            {/* INT STOCK */}
            <div className={cn(
              "flex items-center justify-center w-[48px] py-1 text-center rounded-r-lg",
              isOutOfStock
                ? "bg-red-500/20 font-black text-red-700 dark:text-red-300"
                : isLowStock
                  ? "bg-amber-500/20 font-black text-amber-700 dark:text-amber-300"
                  : hasActiveStock 
                    ? "bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-400" 
                    : "bg-slate-50 dark:bg-slate-800"
            )}>
              <span className="text-sm font-extrabold">{internal}</span>
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
                
                // PERBAIKAN: Jika ada salah satu saja nominal yang stok eksternalnya 0, kategori tsb berstatus KRITIS (Merah)
                const hasCriticalStock = platformStock.some(item => {
                  return item.external !== null && item.external !== 'loading' && item.external !== 'N/A' && Number(item.external) === 0;
                });
                
                const hasLowStock = !hasCriticalStock && platformStock.some(item => {
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
                        <span>{platform.platform_name}</span>
                        {hasCriticalStock ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        ) : hasLowStock ? (
                          <BadgeAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        
                        {/* Tombol Zap Sinkronisasi diletakkan tepat di samping centang status */}
                        {platform.is_external_stock_enabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                onClick={() => openSyncPreview(platform.platform_name)} 
                                disabled={!canSyncPlatform || syncingPlatforms[platform.platform_name]}
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-6 w-6 rounded-full transition-all flex items-center justify-center ml-1 shrink-0 p-0",
                                  canSyncPlatform 
                                    ? "text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 hover:scale-110 active:scale-95" 
                                    : "text-slate-300 dark:text-slate-700 cursor-default"
                                )}
                              >
                                {syncingPlatforms[platform.platform_name] ? (
                                  <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
                                ) : (
                                  <Zap className={cn("h-3.5 w-3.5", canSyncPlatform ? "fill-indigo-600 animate-pulse text-indigo-600" : "")} />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                              {canSyncPlatform 
                                ? "Samakan Stok Semua Nominal di Kategori Ini" 
                                : "Semua Nominal Kategori Ini Sudah Sesuai"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </CardTitle>
                      
                      <div className="flex items-center gap-1">
                        {platform.is_external_stock_enabled && (
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

      {/* Confirmation Dialog showing nominal changes details for Category Sync */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <AlertTriangle className="h-5 w-5 text-indigo-600 animate-pulse" />
              Konfirmasi Sinkronisasi Kategori
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-slate-500 dark:text-slate-400">
              Berikut adalah daftar perubahan nominal pada kategori <strong className="text-slate-800 dark:text-slate-200">"{platformToSync}"</strong> yang akan ditandai terjual untuk menyamakan stok eksternal:
            </DialogDescription>
          </DialogHeader>

          {/* Rincian item update */}
          <div className="py-2.5 max-h-[280px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl px-2 space-y-2 bg-slate-50/50 dark:bg-slate-950/20">
            {syncPreview.map((item) => (
              <div 
                key={item.nominal} 
                className="flex items-center justify-between text-xs p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-lg shadow-2xs"
              >
                <div className="text-left">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatNominalDisplay(item.nominal, platformToSync || '')}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                    <span>Database: <strong>{item.internal}</strong></span>
                    <span>•</span>
                    <span>Eksternal: <strong>{item.external}</strong></span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded-md text-red-600 dark:text-red-400 font-bold font-mono">
                  <span>-{item.diff}</span>
                  <span className="text-[9px] font-medium tracking-tight">Terjual</span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsSyncDialogOpen(false)}>Batal</Button>
            <Button onClick={executePlatformSync} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Ya, Sinkronkan ({syncPreview.reduce((sum, item) => sum + item.diff, 0)} Voucher)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
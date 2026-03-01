"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, PauseCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useDenominations } from "@/contexts/DenominationContext";
import { formatNominalDisplay, cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

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
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();
  const { toast } = useToast();

  const visiblePlatforms = useMemo(() => 
    denominationPlatforms.filter(p => p.is_visible_on_dashboard),
    [denominationPlatforms]
  );

  const fetchStock = useCallback(async () => {
    if (loadingDenominations || visiblePlatforms.length === 0) {
      setLoadingInternal(false);
      return;
    }

    setLoadingInternal(true);
    const results: StockData[] = [];

    for (const platform of visiblePlatforms) {
      const onHoldList = platform.on_hold_denominations || [];
      
      for (const nominal of platform.denominations) {
        const { count } = await supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform.platform_name)
          .eq("nominal", nominal)
          .eq("status", "available");

        results.push({
          platform: platform.platform_name as Platform,
          nominal,
          internal: count || 0,
          external: null,
          isOnHold: onHoldList.includes(nominal)
        });
      }
    }
    
    setStock(results);
    setLoadingInternal(false);
  }, [loadingDenominations, visiblePlatforms]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const activeStock = stock.filter(item => !item.isOnHold);
  const onHoldStock = stock.filter(item => item.isOnHold);

  const renderItem = (item: StockData) => (
    <div key={`${item.platform}-${item.nominal}`} className={cn(
      "flex justify-between items-center p-2 rounded-md",
      item.isOnHold ? "bg-gray-50/50" : "bg-white"
    )}>
      <span className={cn("text-sm", item.isOnHold ? "text-gray-400 italic" : "text-muted-foreground")}>
        {formatNominalDisplay(item.nominal, item.platform)}
      </span>
      <span className={cn("font-bold", item.isOnHold ? "text-gray-400" : "text-primary")}>
        {item.internal}
      </span>
    </div>
  );

  if (loadingInternal) return <div className="p-8 text-center">Memuat Stok...</div>;

  return (
    <div className="w-full max-w-4xl space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visiblePlatforms.map(p => {
          const items = activeStock.filter(s => s.platform === p.platform_name);
          if (items.length === 0) return null;
          return (
            <Card key={p.platform_name}>
              <CardHeader><CardTitle className="text-lg">{p.platform_name}</CardTitle></CardHeader>
              <CardContent className="space-y-1">{items.map(renderItem)}</CardContent>
            </Card>
          );
        })}
      </div>

      {onHoldStock.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <Badge variant="outline" className="text-orange-600 bg-orange-50 gap-1">
              <PauseCircle className="h-3 w-3" /> List On Hold
            </Badge>
            <Separator className="flex-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-70">
            {visiblePlatforms.map(p => {
              const items = onHoldStock.filter(s => s.platform === p.platform_name);
              if (items.length === 0) return null;
              return (
                <Card key={`hold-${p.platform_name}`} className="border-orange-100">
                  <CardHeader className="py-2"><CardTitle className="text-sm text-orange-700">{p.platform_name}</CardTitle></CardHeader>
                  <CardContent className="space-y-1">{items.map(renderItem)}</CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
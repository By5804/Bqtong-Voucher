"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type Platform = "LG" | "wahyu" | "Itemku";
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];
const nominalOptions = [50000, 65000, 100000, 200000, 300000, 500000]; // Menggunakan angka langsung

type DetailedStockData = {
  platform: Platform;
  nominal: number;
  count: number;
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<DetailedStockData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      const allStockPromises: Promise<DetailedStockData>[] = [];

      for (const platform of platformOptions) {
        for (const nominal of nominalOptions) {
          const promise = supabase
            .from("vouchers")
            .select("*", { count: "exact", head: true })
            .eq("platform", platform)
            .eq("nominal", nominal)
            .eq("status", "available")
            .then(({ count }) => ({ platform, nominal, count: count || 0 }));
          allStockPromises.push(promise);
        }
      }

      const results = await Promise.all(allStockPromises);
      setStock(results);
      setLoading(false);
    };

    fetchStock();
  }, []);

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-4">Stok Voucher Tersedia</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading
          ? platformOptions.map((p) => (
              <Card key={p}>
                <CardHeader>
                  <CardTitle><Skeleton className="h-6 w-24" /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {nominalOptions.map((n) => (
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
                    .sort((a, b) => a.nominal - b.nominal) // Urutkan berdasarkan nominal
                    .map(({ nominal, count }) => (
                      <div key={`${platform}-${nominal}`} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{(nominal / 1000).toLocaleString('id-ID')}K</span>
                        <span className="text-lg font-semibold">{count}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
};
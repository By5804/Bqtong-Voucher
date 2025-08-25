"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const platformOptions = ["LG", "wahyu", "Itemku"];

type StockData = {
  platform: string;
  count: number;
};

export const StockDisplay = () => {
  const [stock, setStock] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      const stockPromises = platformOptions.map(async (platform) => {
        const { count } = await supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform)
          .eq("status", "available");
        return { platform, count: count || 0 };
      });

      const results = await Promise.all(stockPromises);
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
                <CardContent>
                  <Skeleton className="h-10 w-16" />
                </CardContent>
              </Card>
            ))
          : stock.map(({ platform, count }) => (
              <Card key={platform}>
                <CardHeader>
                  <CardTitle>{platform}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{count}</p>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
};
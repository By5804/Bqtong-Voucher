"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "@/integrations/supabase/types";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];
const ALL_NOMINAL_OPTIONS = [100, 200, 50000, 65000, 100000, 200000, 300000, 500000];

const formatNominalDisplay = (nominal: number) => {
  if (nominal === 100) return "100 RBX";
  if (nominal === 200) return "200 RBX";
  return (nominal / 1000).toLocaleString('id-ID') + 'K';
};

type DetailedSoldData = {
  platform: Platform;
  nominal: number;
  count: number;
};

export const SoldOutDisplay = () => {
  const [soldData, setSoldData] = useState<DetailedSoldData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSoldData = async () => {
      setLoading(true);
      const allSoldPromises: Promise<DetailedSoldData>[] = [];

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
            .eq("status", "sold") // Filter untuk status 'sold'
            .then(({ count }) => ({ platform, nominal, count: count || 0 }));
          allSoldPromises.push(promise);
        }
      }

      const results = await Promise.all(allSoldPromises);
      setSoldData(results);
      setLoading(false);
    };

    fetchSoldData();
  }, []);

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-4">Data Voucher Terjual</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading
          ? platformOptions.map((p) => (
              <Card key={`sold-skeleton-${p}`}>
                <CardHeader>
                  <CardTitle><Skeleton className="h-6 w-24" /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ALL_NOMINAL_OPTIONS.filter(n => p === "Itemku" || n >= 50000).map((n) => (
                    <div key={`sold-skeleton-${p}-${n}`} className="flex justify-between items-center">
                      <span><Skeleton className="h-4 w-16" /></span>
                      <span><Skeleton className="h-4 w-8" /></span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          : platformOptions.map((platform) => (
              <Card key={`sold-${platform}`}>
                <CardHeader>
                  <CardTitle>{platform}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {soldData
                    .filter(item => item.platform === platform)
                    .sort((a, b) => a.nominal - b.nominal)
                    .map(({ nominal, count }) => (
                      <div key={`sold-${platform}-${nominal}`} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {formatNominalDisplay(nominal)}
                        </span>
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
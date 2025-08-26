"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { subDays, formatISO } from "date-fns";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];
const ALL_NOMINAL_OPTIONS = [100, 200, 400, 50000, 65000, 100000, 200000, 300000, 500000];

const formatNominalDisplay = (nominal: number) => {
  if (nominal === 100) return "100 RBX";
  if (nominal === 200) return "200 RBX";
  if (nominal === 400) return "400 RBX";
  return (nominal / 1000).toLocaleString('id-ID') + 'K';
};

type DetailedSoldData = {
  platform: Platform;
  nominal: number;
  count: number;
};

// Helper function for nominals based on platform
const getNominalsForPlatform = (currentPlatform: Platform) => {
  if (currentPlatform === "Itemku") {
    return ALL_NOMINAL_OPTIONS;
  } else if (currentPlatform === "LG" || currentPlatform === "wahyu") {
    return ALL_NOMINAL_OPTIONS.filter(n => [50000, 65000, 200000].includes(n));
  }
  return []; 
};

export const SoldOutDisplay = () => {
  const [soldData, setSoldData] = useState<DetailedSoldData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    searchDate: '',
    dateRange: 'all', // 'all', 'daily', 'weekly', '2-weeks', 'monthly', 'yearly'
  });

  const handleFilterChange = (key: 'searchDate' | 'dateRange', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ searchDate: '', dateRange: 'all' });
  };

  const fetchSoldData = useCallback(async () => {
    setLoading(true);
    const allSoldPromises: Promise<DetailedSoldData>[] = [];

    const today = new Date();
    let startDate: Date | null = null;

    if (filters.searchDate) {
      // Specific date filter takes precedence
      startDate = new Date(filters.searchDate);
    } else {
      // Date range filter
      switch (filters.dateRange) {
        case 'daily': startDate = today; break;
        case 'weekly': startDate = subDays(today, 7); break;
        case '2-weeks': startDate = subDays(today, 14); break;
        case 'monthly': startDate = subDays(today, 30); break;
        case 'yearly': startDate = subDays(today, 365); break;
        case 'all': // No date filter
        default: startDate = null; break;
      }
    }

    const formattedStartDate = startDate ? formatISO(startDate, { representation: 'date' }) : null;

    for (const platform of platformOptions) {
      const nominals = getNominalsForPlatform(platform); // Use helper function

      for (const nominal of nominals) {
        let query = supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform)
          .eq("nominal", nominal)
          .eq("status", "sold"); // Filter untuk status 'sold'

        if (formattedStartDate) {
          query = query.gte('tanggal', formattedStartDate);
          // If specific date, also add lte for the same day to ensure exact match
          if (filters.searchDate) {
            query = query.lte('tanggal', formattedStartDate);
          }
        }

        const promise = query.then(({ count, error }) => {
          if (error) {
            console.error(`Error fetching sold data for ${platform} ${nominal}:`, error.message);
            toast({ title: "Error", description: `Gagal memuat data terjual untuk ${platform} ${formatNominalDisplay(nominal)}: ${error.message}`, variant: "destructive" });
            return { platform, nominal, count: 0 }; // Return 0 count on error
          }
          return { platform, nominal, count: count || 0 };
        });
        allSoldPromises.push(promise);
      }
    }

    const results = await Promise.all(allSoldPromises);
    setSoldData(results);
    setLoading(false);
  }, [filters, toast]);

  useEffect(() => {
    fetchSoldData();
  }, [fetchSoldData]);

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-4">Data Voucher Terjual</h2>
      <Card className="mb-8">
        <CardHeader><CardTitle>Filter Data Terjual</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="search-date">Tanggal Spesifik</Label>
              <Input id="search-date" type="date" value={filters.searchDate} onChange={e => handleFilterChange('searchDate', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="date-range">Rentang Waktu</Label>
              <Select value={filters.dateRange} onValueChange={value => handleFilterChange('dateRange', value)}>
                <SelectTrigger id="date-range"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="2-weeks">2 Minggu</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                  <SelectItem value="yearly">Tahunan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={fetchSoldData}>Terapkan Filter</Button>
              <Button type="button" variant="outline" onClick={clearFilters}>Hapus Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading
          ? platformOptions.map((p) => (
              <Card key={`sold-skeleton-${p}`}>
                <CardHeader>
                  <CardTitle><Skeleton className="h-6 w-24" /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {getNominalsForPlatform(p).map((n) => (
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
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
import { useDenominations } from "@/contexts/DenominationContext";
import { formatNominalDisplay } from "@/lib/utils";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

type DetailedSoldData = {
  platform: Platform;
  nominal: string;
  count: number;
};

export const SoldOutDisplay = () => {
  const [soldData, setSoldData] = useState<DetailedSoldData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();

  const [filters, setFilters] = useState({
    searchDate: '',
    dateRange: 'daily',
  });

  const [serverTime, setServerTime] = useState<string | null>(null);
  const [loadingServerTime, setLoadingServerTime] = useState(true);

  const handleFilterChange = (key: 'searchDate' | 'dateRange', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ searchDate: '', dateRange: 'all' });
  };

  const fetchServerTime = useCallback(async () => {
    setLoadingServerTime(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-server-time');
      if (error) {
        console.error("Error fetching server time:", error.message);
        toast({ title: "Error", description: `Gagal memuat waktu server: ${error.message}`, variant: "destructive" });
        setServerTime(null);
      } else {
        setServerTime(data.timestamp);
        if (filters.dateRange === 'daily' && !filters.searchDate) {
          const serverDate = new Date(data.timestamp);
          setFilters(prev => ({ ...prev, searchDate: formatISO(serverDate, { representation: 'date' }) }));
        }
      }
    } catch (err: any) {
      console.error("General error fetching server time:", err.message);
      toast({ title: "Error", description: `Terjadi kesalahan saat memuat waktu server: ${err.message}`, variant: "destructive" });
      setServerTime(null);
    } finally {
      setLoadingServerTime(false);
    }
  }, [toast, filters.dateRange, filters.searchDate]);

  const fetchSoldData = useCallback(async () => {
    if (loadingDenominations) return;
    setLoading(true);
    const allSoldPromises: Promise<DetailedSoldData>[] = [];

    let queryStartDate: Date | null = null;
    let queryEndDate: Date | null = null;

    if (filters.searchDate) {
      const parts = filters.searchDate.split('-').map(p => parseInt(p, 10));
      queryStartDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      queryEndDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    } else if (serverTime) {
        const today = new Date(serverTime);
        switch (filters.dateRange) {
          case 'daily': queryStartDate = today; queryEndDate = today; break;
          case 'weekly': queryStartDate = subDays(today, 7); queryEndDate = today; break;
          case '2-weeks': queryStartDate = subDays(today, 14); queryEndDate = today; break;
          case 'monthly': queryStartDate = subDays(today, 30); queryEndDate = today; break;
          case 'yearly': queryStartDate = subDays(today, 365); queryEndDate = today; break;
          default: break;
        }
    }

    let formattedStartDate: string | null = null;
    let formattedEndDate: string | null = null;

    if (queryStartDate) {
        queryStartDate.setUTCHours(0, 0, 0, 0);
        formattedStartDate = queryStartDate.toISOString();
    }
    if (queryEndDate) {
        queryEndDate.setUTCHours(23, 59, 59, 999);
        formattedEndDate = queryEndDate.toISOString();
    }

    for (const platform of denominationPlatforms) {
      for (const nominal of platform.denominations) {
        let query = supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform.platform_name)
          .eq("nominal", nominal)
          .eq("status", "sold")
          .not('sold_at', 'is', null);

        if (formattedStartDate) query = query.gte('sold_at', formattedStartDate);
        if (formattedEndDate) query = query.lte('sold_at', formattedEndDate);

        const promise = query.then(({ count, error }) => {
          if (error) {
            console.error(`Error fetching sold data for ${platform.platform_name} ${nominal}:`, error.message);
            toast({ title: "Error", description: `Gagal memuat data terjual untuk ${platform.platform_name} ${formatNominalDisplay(nominal, platform.platform_name)}: ${error.message}`, variant: "destructive" });
            return { platform: platform.platform_name as Platform, nominal, count: 0 };
          }
          return { platform: platform.platform_name as Platform, nominal, count: count || 0 };
        });
        allSoldPromises.push(promise);
      }
    }

    const results = await Promise.all(allSoldPromises);
    setSoldData(results);
    setLoading(false);
  }, [filters, serverTime, toast, denominationPlatforms, loadingDenominations]);

  useEffect(() => {
    fetchServerTime();
    const interval = setInterval(fetchServerTime, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchServerTime]);

  useEffect(() => {
    if ((serverTime || filters.searchDate || filters.dateRange === 'all') && !loadingDenominations) {
      fetchSoldData();
    }
  }, [fetchSoldData, serverTime, filters.searchDate, filters.dateRange, loadingDenominations]);

  const isLoading = loading || loadingDenominations;

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
        {isLoading
          ? denominationPlatforms.map((p) => (
              <Card key={`sold-skeleton-${p.platform_name}`}>
                <CardHeader>
                  <CardTitle><Skeleton className="h-6 w-24" /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.denominations.map((n) => (
                    <div key={`sold-skeleton-${p.platform_name}-${n}`} className="flex justify-between items-center">
                      <span><Skeleton className="h-4 w-16" /></span>
                      <span><Skeleton className="h-4 w-8" /></span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          : denominationPlatforms.map((platform) => (
              <Card key={`sold-${platform.platform_name}`}>
                <CardHeader>
                  <CardTitle>{platform.platform_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {soldData
                    .filter(item => item.platform === platform.platform_name)
                    .sort((a, b) => {
                      const numA = parseInt(a.nominal, 10);
                      const numB = parseInt(b.nominal, 10);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      if (!isNaN(numA)) return -1;
                      if (!isNaN(numB)) return 1;
                      return a.nominal.localeCompare(b.nominal);
                    })
                    .map(({ nominal, count }) => (
                      <div key={`sold-${platform.platform_name}-${nominal}`} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {formatNominalDisplay(nominal, platform.platform_name)}
                        </span>
                        <span className="text-lg font-semibold">{count}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
      </div>
      <div className="text-center text-sm text-muted-foreground mt-8">
        {loadingServerTime ? (
          <span>Memuat waktu server...</span>
        ) : serverTime ? (
          <span>Waktu Server: {new Date(serverTime).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}</span>
        ) : (
          <span>Gagal memuat waktu server.</span>
        )}
      </div>
    </div>
  );
};
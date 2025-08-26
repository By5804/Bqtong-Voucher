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
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"];

const formatNominalDisplay = (nominal: string | number) => {
  const strNominal = String(nominal);
  if (strNominal === "100") return "100 RBX";
  if (strNominal === "200") return "200 RBX";
  if (strNominal === "400") return "400 RBX";
  if (strNominal.includes("Random Steam Key")) return strNominal;

  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return numNominal.toLocaleString('id-ID') + 'K';
  }
  return strNominal;
};

type DetailedSoldData = {
  platform: Platform;
  nominal: string;
  count: number;
};

const getNominalsForPlatform = (currentPlatform: Platform) => {
  if (currentPlatform === "Itemku") {
    return ["100", "200", "400", "50000", "65000", "100000", "200000", "300000", "500000"];
  } else if (currentPlatform === "LG" || currentPlatform === "wahyu") {
    return ["50000", "65000", "200000"];
  } else if (currentPlatform === "Itemku Steam Game Key") {
    return ["Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];
  }
  return []; 
};

export const SoldOutDisplay = () => {
  const [soldData, setSoldData] = useState<DetailedSoldData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    searchDate: '', // Default kosong, akan diisi dari serverTime
    dateRange: 'daily', // Default to daily transactions
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
        // Set default searchDate to server's current date if dateRange is 'daily'
        if (filters.dateRange === 'daily') {
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
  }, [toast, filters.dateRange]); // Tambahkan filters.dateRange sebagai dependency

  const fetchSoldData = useCallback(async () => {
    setLoading(true);
    const allSoldPromises: Promise<DetailedSoldData>[] = [];

    let queryStartDate: Date | null = null;
    let queryEndDate: Date | null = null;

    if (filters.searchDate) {
      queryStartDate = new Date(filters.searchDate);
      queryEndDate = new Date(filters.searchDate); // For a single specific day
    } else {
      // If searchDate is empty, use dateRange logic based on serverTime if available
      if (serverTime) {
        const today = new Date(serverTime); // Use server time for 'today'
        switch (filters.dateRange) {
          case 'daily':
            queryStartDate = today;
            queryEndDate = today;
            break;
          case 'weekly':
            queryStartDate = subDays(today, 7);
            queryEndDate = today;
            break;
          case '2-weeks':
            queryStartDate = subDays(today, 14);
            queryEndDate = today;
            break;
          case 'monthly':
            queryStartDate = subDays(today, 30);
            queryEndDate = today;
            break;
          case 'yearly':
            queryStartDate = subDays(today, 365);
            queryEndDate = today;
            break;
          case 'all':
          default:
            // No date filters
            break;
        }
      }
    }

    const formattedStartDate = queryStartDate ? formatISO(queryStartDate, { representation: 'date' }) : null;
    const formattedEndDate = queryEndDate ? formatISO(queryEndDate, { representation: 'date' }) : null;

    for (const platform of platformOptions) {
      const nominals = getNominalsForPlatform(platform);

      for (const nominal of nominals) {
        let query = supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform)
          .eq("nominal", nominal)
          .eq("status", "sold");

        if (formattedStartDate) {
          query = query.gte('tanggal', formattedStartDate);
        }
        if (formattedEndDate) {
          query = query.lte('tanggal', formattedEndDate);
        }

        const promise = query.then(({ count, error }) => {
          if (error) {
            console.error(`Error fetching sold data for ${platform} ${nominal}:`, error.message);
            toast({ title: "Error", description: `Gagal memuat data terjual untuk ${platform} ${formatNominalDisplay(nominal)}: ${error.message}`, variant: "destructive" });
            return { platform, nominal, count: 0 };
          }
          return { platform, nominal, count: count || 0 };
        });
        allSoldPromises.push(promise);
      }
    }

    const results = await Promise.all(allSoldPromises);
    setSoldData(results);
    setLoading(false);
  }, [filters, serverTime, toast]); // Tambahkan serverTime sebagai dependency

  useEffect(() => {
    fetchServerTime(); // Fetch server time on initial load
    const interval = setInterval(fetchServerTime, 60 * 1000); // Refresh server time every minute
    return () => clearInterval(interval);
  }, [fetchServerTime]);

  useEffect(() => {
    // Panggil fetchSoldData hanya jika serverTime sudah tersedia atau filter sudah diatur
    if (serverTime || filters.searchDate || filters.dateRange === 'all') {
      fetchSoldData();
    }
  }, [fetchSoldData, serverTime, filters.searchDate, filters.dateRange]);


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
                    .sort((a, b) => {
                      const nominalA = a.nominal;
                      const nominalB = b.nominal;
                      const numA = parseInt(nominalA, 10);
                      const numB = parseInt(nominalB, 10);

                      if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                      }
                      if (!isNaN(numA)) return -1;
                      if (!isNaN(numB)) return 1;
                      return nominalA.localeCompare(nominalB);
                    })
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
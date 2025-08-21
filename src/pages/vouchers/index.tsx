"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";
import { subDays, formatISO } from "date-fns";

type Voucher = Database['public']['Tables']['vouchers']['Row'];

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [filters, setFilters] = useState({
    searchDate: '',
    dateRange: 'all',
    searchCode: '',
    platform: 'all'
  });

  const fetchVouchers = async () => {
    setLoading(true);
    let query = supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false });

    // Date filters
    if (filters.searchDate) {
      query = query.eq('tanggal', filters.searchDate);
    } else if (filters.dateRange !== 'all') {
      const today = new Date();
      let startDate;
      switch (filters.dateRange) {
        case 'daily':
          startDate = today;
          break;
        case 'weekly':
          startDate = subDays(today, 7);
          break;
        case '2-weeks':
          startDate = subDays(today, 14);
          break;
        case 'monthly':
          startDate = subDays(today, 30);
          break;
        case 'yearly':
          startDate = subDays(today, 365);
          break;
      }
      if (startDate) {
        query = query.gte('tanggal', formatISO(startDate, { representation: 'date' }));
      }
    }

    if (filters.searchCode) {
      query = query.ilike('code', `%${filters.searchCode}%`);
    }
    if (filters.platform !== 'all') {
      query = query.eq('platform', filters.platform);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setVouchers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value, dateRange: 'all' }));
  };

  const handleSelectChange = (name: 'platform' | 'dateRange', value: string) => {
    const newFilters = { ...filters, [name]: value };
    if (name === 'dateRange' && value !== 'all') {
      newFilters.searchDate = '';
    }
    setFilters(newFilters);
  };
  
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVouchers();
  };

  const clearFilters = () => {
    setFilters({
      searchDate: '',
      dateRange: 'all',
      searchCode: '',
      platform: 'all'
    });
    // Re-fetch all vouchers after clearing
    fetchVouchers();
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Voucher</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter Voucher</h2>
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cari per Tanggal</label>
              <Input 
                type="date"
                name="searchDate"
                value={filters.searchDate}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Filter Periode</label>
              <Select 
                value={filters.dateRange}
                onValueChange={(value) => handleSelectChange('dateRange', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="2-weeks">2 Minggu</SelectItem>
                  <SelectItem value="monthly">1 Bulan</SelectItem>
                  <SelectItem value="yearly">1 Tahun</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cari Kode Voucher</label>
              <Input 
                type="text"
                name="searchCode"
                placeholder="Masukkan kode..."
                value={filters.searchCode}
                onChange={(e) => setFilters(prev => ({...prev, searchCode: e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <Select 
                value={filters.platform}
                onValueChange={(value) => handleSelectChange('platform', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Platform</SelectItem>
                  <SelectItem value="LG">LG</SelectItem>
                  <SelectItem value="wahyu">wahyu</SelectItem>
                  <SelectItem value="Itemku">Itemku</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-4">
            <Button type="submit">Terapkan Filter</Button>
            <Button type="button" variant="outline" onClick={clearFilters}>Hapus Filter</Button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Daftar Voucher</h2>
        {loading ? (
          <p>Memuat data...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Kode Voucher</TableHead>
                <TableHead>Platform</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell>{new Date(voucher.tanggal + 'T00:00:00').toLocaleDateString()}</TableCell>
                  <TableCell>{voucher.nominal.toLocaleString()}</TableCell>
                  <TableCell>{voucher.code}</TableCell>
                  <TableCell>{voucher.platform}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
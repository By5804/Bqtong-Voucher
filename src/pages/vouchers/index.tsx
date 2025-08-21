"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";

type Voucher = Database['public']['Tables']['vouchers']['Row'];

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    searchCode: '',
    platform: 'all'
  });

  const fetchVouchers = async () => {
    setLoading(true);
    let query = supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.startDate) {
      query = query.gte('tanggal', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('tanggal', filters.endDate);
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
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handlePlatformChange = (value: string) => {
    setFilters(prev => ({ ...prev, platform: value }));
  };
  
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVouchers();
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
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
              <label className="block text-sm font-medium mb-1">Dari Tanggal</label>
              <Input 
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sampai Tanggal</label>
              <Input 
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cari Kode Voucher</label>
              <Input 
                type="text"
                name="searchCode"
                placeholder="Masukkan kode..."
                value={filters.searchCode}
                onChange={handleFilterChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <Select 
                value={filters.platform}
                onValueChange={handlePlatformChange}
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
                  <TableCell>{new Date(voucher.tanggal).toLocaleDateString()}</TableCell>
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
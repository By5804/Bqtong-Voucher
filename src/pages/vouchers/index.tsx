"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";
import { subDays, formatISO } from "date-fns";
import { Trash2 } from "lucide-react";

type Voucher = Database['public']['Tables']['vouchers']['Row'];

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

    if (filters.searchDate) {
      query = query.eq('tanggal', filters.searchDate);
    } else if (filters.dateRange !== 'all') {
      const today = new Date();
      let startDate;
      switch (filters.dateRange) {
        case 'daily': startDate = today; break;
        case 'weekly': startDate = subDays(today, 7); break;
        case '2-weeks': startDate = subDays(today, 14); break;
        case 'monthly': startDate = subDays(today, 30); break;
        case 'yearly': startDate = subDays(today, 365); break;
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
    setSelectedVouchers([]);
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVouchers();
  };

  const clearFilters = () => {
    setFilters({ searchDate: '', dateRange: 'all', searchCode: '', platform: 'all' });
    fetchVouchers();
  }

  const handleSelectVoucher = (id: string, checked: boolean) => {
    setSelectedVouchers(prev => 
      checked ? [...prev, id] : prev.filter(voucherId => voucherId !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedVouchers(checked ? vouchers.map(v => v.id) : []);
  };

  const handleDelete = async () => {
    if (selectedVouchers.length === 0) return;
    
    const { error } = await supabase
      .from('vouchers')
      .delete()
      .in('id', selectedVouchers);

    if (error) {
      toast({ title: "Error", description: `Gagal menghapus voucher: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${selectedVouchers.length} voucher berhasil dihapus.` });
      fetchVouchers(); // Refresh data
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Voucher</h1>
      
      {/* Filter Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter Voucher</h2>
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          {/* ... form fields ... */}
          <div className="flex gap-4">
            <Button type="submit">Terapkan Filter</Button>
            <Button type="button" variant="outline" onClick={clearFilters}>Hapus Filter</Button>
          </div>
        </form>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Daftar Voucher</h2>
          {selectedVouchers.length > 0 && (
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus ({selectedVouchers.length}) Voucher
            </Button>
          )}
        </div>
        {loading ? (
          <p>Memuat data...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedVouchers.length === vouchers.length && vouchers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Kode Voucher</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVouchers.includes(voucher.id)}
                      onCheckedChange={(checked) => handleSelectVoucher(voucher.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>{new Date(voucher.tanggal + 'T00:00:00').toLocaleDateString()}</TableCell>
                  <TableCell>{voucher.nominal.toLocaleString()}</TableCell>
                  <TableCell>{voucher.code}</TableCell>
                  <TableCell>{voucher.platform}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setSelectedVouchers([voucher.id]);
                      setIsDeleteDialogOpen(true);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Ini akan menghapus {selectedVouchers.length} voucher secara permanen dari server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
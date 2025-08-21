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
import { useEffect, useState, useCallback } from "react";
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

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalVouchers, setTotalVouchers] = useState(0);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from('vouchers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

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

    const { data, error, count } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setVouchers(data || []);
      setTotalVouchers(count || 0);
    }
    setLoading(false);
    setSelectedVouchers([]);
  }, [currentPage, itemsPerPage, filters, toast]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchVouchers();
  };

  const clearFilters = () => {
    setFilters({ searchDate: '', dateRange: 'all', searchCode: '', platform: 'all' });
    setCurrentPage(1);
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
      fetchVouchers();
    }
    setIsDeleteDialogOpen(false);
  };

  const totalPages = Math.ceil(totalVouchers / itemsPerPage);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Voucher</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter Voucher</h2>
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="flex gap-4">
            <Button type="submit">Terapkan Filter</Button>
            <Button type="button" variant="outline" onClick={clearFilters}>Hapus Filter</Button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Daftar Voucher ({totalVouchers})</h2>
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
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedVouchers.length === vouchers.length && vouchers.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
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
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Items per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / Halaman</SelectItem>
                    <SelectItem value="25">25 / Halaman</SelectItem>
                    <SelectItem value="50">50 / Halaman</SelectItem>
                    <SelectItem value="100">100 / Halaman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

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
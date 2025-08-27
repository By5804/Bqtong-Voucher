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
import { useEffect, useState, useCallback, useMemo } from "react";
import { subDays, formatISO } from "date-fns";
import { Trash2, ArrowLeft, Lock, Unlock } from "lucide-react"; // Added Lock and Unlock icons
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

type Voucher = Database['public']['Tables']['vouchers']['Row'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
type Source = NonNullable<Database['public']['Tables']['vouchers']['Row']['source']>;
type Status = Database['public']['Tables']['vouchers']['Row']['status'];

const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"];
const sourceOptions: Source[] = ["Paygift website", "Paygift Sales", "Tokopedia", "Manual Adjustment", "Random"];
const statusOptions: Status[] = ["available", "sold"];

const formatNominalDisplay = (nominal: string | number) => {
  const strNominal = String(nominal);
  if (strNominal === "100") return "100 RBX";
  if (strNominal === "200") return "200 RBX";
  if (strNominal === "400") return "400 RBX";
  if (strNominal === "500") return "500 RBX"; // Added 500 RBX
  if (strNominal.includes("Random Steam Key")) return strNominal;

  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return numNominal.toLocaleString('id-ID'); // No 'K' suffix for table display
  }
  return strNominal;
};

const getFilteredNominalOptionsForFilter = (platformFilter: Platform | 'all') => {
  if (platformFilter === "Itemku") {
    return ["100", "200", "400", "500", "50000", "65000", "100000", "200000", "300000", "500000"]; // Added "500"
  } else if (platformFilter === "LG" || platformFilter === "wahyu") {
    return ["50000", "65000", "200000"];
  } else if (platformFilter === "Itemku Steam Game Key") {
    return ["Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];
  }
  // If 'all' platforms are selected, return a comprehensive list of all possible nominals
  return [
    "100", "200", "400", "500", "50000", "65000", "100000", "200000", "300000", "500000", // Added "500"
    "Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"
  ];
};

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [decryptionPin, setDecryptionPin] = useState(""); // New state for decryption PIN
  const [isPinEntered, setIsPinEntered] = useState(false); // To track if PIN has been successfully used
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState({
    searchDate: '',
    dateRange: 'all',
    searchCode: '', // This will be ignored for encrypted codes
    platform: 'all',
    source: 'all',
    nominal: 'all',
    status: 'all'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalVouchers, setTotalVouchers] = useState(0);

  const filteredNominalOptionsForFilter = useMemo(() => getFilteredNominalOptionsForFilter(filters.platform), [filters.platform]);

  useEffect(() => {
    if (filters.nominal !== 'all' && !filteredNominalOptionsForFilter.includes(filters.nominal)) {
      setFilters(prev => ({ ...prev, nominal: 'all' }));
    }
  }, [filters.platform, filters.nominal, filteredNominalOptionsForFilter]);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    // Prepare filters for the Edge Function
    const edgeFunctionFilters = { ...filters };
    delete edgeFunctionFilters.searchCode; // Cannot search encrypted codes directly

    const { data, error } = await supabase.functions.invoke('decrypt-vouchers', {
      body: { 
        encryptionKey: decryptionPin, 
        filters: edgeFunctionFilters,
        from,
        to
      },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memuat voucher: ${error.message}. Pastikan PIN dekripsi benar.`, variant: "destructive" });
      setVouchers([]);
      setTotalVouchers(0);
      setIsPinEntered(false);
    } else {
      setVouchers(data.data || []);
      setTotalVouchers(data.count || 0);
      setIsPinEntered(true);
    }
    setLoading(false);
    setSelectedVouchers([]);
  }, [currentPage, itemsPerPage, filters, decryptionPin, toast]);

  useEffect(() => {
    if (isPinEntered) { // Only fetch if PIN has been successfully entered
      fetchVouchers();
    } else {
      setVouchers([]); // Clear vouchers if PIN is not entered or incorrect
      setTotalVouchers(0);
    }
  }, [fetchVouchers, isPinEntered]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    if (isPinEntered) {
      fetchVouchers();
    } else {
      toast({ title: "Peringatan", description: "Harap masukkan PIN dekripsi terlebih dahulu.", variant: "default" });
    }
  };

  const clearFilters = () => {
    setFilters({ searchDate: '', dateRange: 'all', searchCode: '', platform: 'all', source: 'all', nominal: 'all', status: 'all' });
    setCurrentPage(1);
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
    
    const { error } = await supabase.from('vouchers').delete().in('id', selectedVouchers);

    if (error) {
      toast({ title: "Error", description: `Gagal menghapus voucher: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${selectedVouchers.length} voucher berhasil dihapus.` });
      fetchVouchers(); // Re-fetch after deletion
    }
    setIsDeleteDialogOpen(false);
  };

  const totalPages = Math.ceil(totalVouchers / itemsPerPage);

  const handleDecryptAndFetch = () => {
    if (!decryptionPin.trim()) {
      toast({ title: "Error", description: "PIN Dekripsi tidak boleh kosong.", variant: "destructive" });
      return;
    }
    setIsPinEntered(true); // Attempt to fetch with the provided PIN
    setCurrentPage(1);
    fetchVouchers();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Manajemen Voucher</h1>
      </div>
      
      <Card className="mb-8">
        <CardHeader><CardTitle>Filter Voucher</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleFilterSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search-date">Tanggal Spesifik</Label>
                <Input id="search-date" type="date" value={filters.searchDate} onChange={e => handleFilterChange('searchDate', e.target.value)} disabled={!isPinEntered} />
              </div>
              <div>
                <Label htmlFor="date-range">Rentang Waktu</Label>
                <Select value={filters.dateRange} onValueChange={value => handleFilterChange('dateRange', value)} disabled={!isPinEntered}>
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
              <div>
                <Label htmlFor="platform">Platform</Label>
                <Select value={filters.platform} onValueChange={value => handleFilterChange('platform', value)} disabled={!isPinEntered}>
                  <SelectTrigger id="platform"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Platform</SelectItem>
                    {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="source">Source</Label>
                <Select value={filters.source} onValueChange={value => handleFilterChange('source', value)} disabled={!isPinEntered}>
                  <SelectTrigger id="source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Source</SelectItem>
                    {sourceOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nominal">Nominal</Label>
                <Select value={filters.nominal} onValueChange={value => handleFilterChange('nominal', value)} disabled={!filters.platform || !isPinEntered}>
                  <SelectTrigger id="nominal"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Nominal</SelectItem>
                    {filteredNominalOptionsForFilter.map(n => (
                      <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={filters.status} onValueChange={value => handleFilterChange('status', value)} disabled={!isPinEntered}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="search-code">Cari Kode Voucher</Label>
                <Input id="search-code" placeholder="Pencarian kode tidak tersedia untuk voucher terenkripsi" value={filters.searchCode} onChange={e => handleFilterChange('searchCode', e.target.value)} disabled={true} />
              </div>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={!isPinEntered}>Terapkan Filter</Button>
              <Button type="button" variant="outline" onClick={clearFilters} disabled={!isPinEntered}>Hapus Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Daftar Voucher ({totalVouchers})</CardTitle>
            {selectedVouchers.length > 0 && (
              <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={!isPinEntered}>
                <Trash2 className="mr-2 h-4 w-4" /> Hapus ({selectedVouchers.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isPinEntered ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Masukkan PIN untuk melihat kode voucher.</p>
              <div className="flex w-full max-w-sm gap-2">
                <Input 
                  type="password" 
                  placeholder="Masukkan PIN Dekripsi" 
                  value={decryptionPin} 
                  onChange={(e) => setDecryptionPin(e.target.value)} 
                  disabled={loading}
                />
                <Button onClick={handleDecryptAndFetch} disabled={loading || !decryptionPin.trim()}>
                  {loading ? "Memuat..." : <Unlock className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : loading ? (<p>Memuat data...</p>) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"><Checkbox checked={selectedVouchers.length === vouchers.length && vouchers.length > 0} onCheckedChange={(checked) => handleSelectAll(!!checked)} /></TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Kode Voucher</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell><Checkbox checked={selectedVouchers.includes(voucher.id)} onCheckedChange={(checked) => handleSelectVoucher(voucher.id, !!checked)} /></TableCell>
                      <TableCell>{new Date(voucher.tanggal + 'T00:00:00').toLocaleDateString()}</TableCell>
                      <TableCell>
                        {formatNominalDisplay(voucher.nominal)}
                      </TableCell>
                      <TableCell>{voucher.code}</TableCell>
                      <TableCell>{voucher.platform}</TableCell>
                      <TableCell>{voucher.source || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          voucher.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {voucher.status === 'available' ? 'Tersedia' : 'Terjual'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedVouchers([voucher.id]); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {vouchers.length === 0 && !loading && (<div className="text-center py-10 text-gray-500"><p>Tidak ada voucher yang cocok dengan filter Anda.</p></div>)}
              <div className="flex items-center justify-between mt-4">
                <div>
                  <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / Halaman</SelectItem>
                      <SelectItem value="25">25 / Halaman</SelectItem>
                      <SelectItem value="50">50 / Halaman</SelectItem>
                      <SelectItem value="100">100 / Halaman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">Halaman {currentPage} dari {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0}>Berikutnya</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus {selectedVouchers.length} voucher secara permanen.</AlertDialogDescription>
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
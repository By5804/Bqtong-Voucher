"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

type Voucher = Database['public']['Tables']['vouchers']['Row'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];

const ALL_NOMINAL_OPTIONS_STR = ["100", "200", "50000", "65000", "100000", "200000", "300000", "500000"];

const formatNominalDisplay = (nominal: string) => {
  const numNominal = parseInt(nominal, 10);
  if (numNominal === 100) return "100 RBX";
  if (numNominal === 200) return "200 RBX";
  return (numNominal / 1000).toLocaleString('id-ID') + 'K';
};

const getFilteredNominalOptions = (platform: Platform | 'all') => {
  if (platform === "Itemku") {
    return ALL_NOMINAL_OPTIONS_STR;
  } else if (platform === "LG" || platform === "wahyu") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => parseInt(n, 10) >= 50000);
  }
  return ALL_NOMINAL_OPTIONS_STR;
};

export default function MoveVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  
  const [sourcePlatform, setSourcePlatform] = useState<Platform | 'all'>('all');
  const [targetPlatform, setTargetPlatform] = useState<Platform | ''>('');
  const [nominal, setNominal] = useState<string>('all');
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalVouchers, setTotalVouchers] = useState(0);

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(sourcePlatform), [sourcePlatform]);

  useEffect(() => {
    if (nominal !== 'all' && !filteredNominalOptions.includes(nominal)) {
      setNominal('all');
    }
  }, [sourcePlatform, nominal, filteredNominalOptions]);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setSelectedVouchers([]);
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from('vouchers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (sourcePlatform !== 'all') {
      query = query.eq('platform', sourcePlatform);
    }
    if (nominal !== 'all') {
      query = query.eq('nominal', parseInt(nominal, 10));
    }

    const { data, error, count } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setVouchers(data || []);
      setTotalVouchers(count || 0);
    }
    setLoading(false);
  }, [currentPage, itemsPerPage, sourcePlatform, nominal, toast]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchVouchers();
  };

  const handleSelectVoucher = (id: string, checked: boolean) => {
    setSelectedVouchers(prev => 
      checked ? [...prev, id] : prev.filter(voucherId => voucherId !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedVouchers(checked ? vouchers.map(v => v.id) : []);
  };

  const handleMoveVouchers = async () => {
    if (selectedVouchers.length === 0 || !targetPlatform) {
      toast({
        title: "Informasi Kurang",
        description: "Silakan pilih minimal satu voucher dan platform tujuan.",
        variant: "destructive"
      });
      return;
    }
    
    if (sourcePlatform !== 'all' && sourcePlatform === targetPlatform) {
        toast({
            title: "Aksi Tidak Valid",
            description: "Platform sumber dan tujuan tidak boleh sama.",
            variant: "destructive"
        });
        return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('vouchers')
      .update({ platform: targetPlatform })
      .in('id', selectedVouchers);

    if (error) {
      toast({ title: "Error", description: `Gagal memindahkan voucher: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${selectedVouchers.length} voucher berhasil dipindahkan ke ${targetPlatform}.` });
      fetchVouchers(); 
    }
    setLoading(false);
  };

  const availableTargetPlatforms = platformOptions.filter(p => sourcePlatform === 'all' || p !== sourcePlatform);
  const totalPages = Math.ceil(totalVouchers / itemsPerPage);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Pindahkan Voucher Antar Platform</h1>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filter & Pindahkan</CardTitle>
          <CardDescription>Pilih platform sumber dan nominal untuk menampilkan voucher, lalu pilih platform tujuan untuk memindahkannya.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="source-platform" className="block text-sm font-medium mb-1">Dari Platform</label>
              <Select value={sourcePlatform} onValueChange={(value: Platform | 'all') => {
                  setSourcePlatform(value);
                  setCurrentPage(1);
                }}>
                <SelectTrigger id="source-platform">
                  <SelectValue placeholder="Pilih Platform Sumber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Platform</SelectItem>
                  {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="nominal-filter" className="block text-sm font-medium mb-1">Nominal</label>
              <Select value={nominal} onValueChange={setNominal}>
                <SelectTrigger id="nominal-filter">
                  <SelectValue placeholder="Pilih Nominal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Nominal</SelectItem>
                  {filteredNominalOptions.map(n => (
                    <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full md:w-auto">Tampilkan Voucher</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                    <CardTitle>Daftar Voucher ({totalVouchers})</CardTitle>
                    <CardDescription>{selectedVouchers.length} voucher dipilih.</CardDescription>
                </div>
                <div className="flex gap-4 items-center w-full sm:w-auto">
                    <div className="flex-1">
                        <Select 
                            value={targetPlatform} 
                            onValueChange={(value: Platform) => setTargetPlatform(value)}
                            disabled={sourcePlatform === 'all'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Tujuan" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTargetPlatforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleMoveVouchers} disabled={loading || selectedVouchers.length === 0 || !targetPlatform}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Pindahkan
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
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
                        aria-label="Pilih semua"
                      />
                    </TableHead>
                    <TableHead>Kode Voucher</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Platform Saat Ini</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((voucher) => (
                    <TableRow key={voucher.id} data-state={selectedVouchers.includes(voucher.id) && "selected"}>
                      <TableCell>
                        <Checkbox
                          checked={selectedVouchers.includes(voucher.id)}
                          onCheckedChange={(checked) => handleSelectVoucher(voucher.id, !!checked)}
                          aria-label={`Pilih voucher ${voucher.code}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{voucher.code}</TableCell>
                      <TableCell>{formatNominalDisplay(String(voucher.nominal))}</TableCell>
                      <TableCell>{voucher.platform}</TableCell>
                      <TableCell>{voucher.source || '-'}</TableCell>
                      <TableCell>{new Date(voucher.tanggal + 'T00:00:00').toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {vouchers.length === 0 && !loading && (
                <div className="text-center py-10 text-gray-500">
                    <p>Tidak ada voucher yang ditemukan untuk filter yang dipilih.</p>
                </div>
              )}
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
        </CardContent>
      </Card>
    </div>
  );
}
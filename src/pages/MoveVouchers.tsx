"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowRight } from "lucide-react";

type Voucher = Database['public']['Tables']['vouchers']['Row'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

export default function MoveVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [targetPlatform, setTargetPlatform] = useState<Platform | ''>('');
  const { toast } = useToast();

  const fetchVouchers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false });

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

    setLoading(true);
    const { error } = await supabase
      .from('vouchers')
      .update({ platform: targetPlatform })
      .in('id', selectedVouchers);

    if (error) {
      toast({ title: "Error", description: `Gagal memindahkan voucher: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${selectedVouchers.length} voucher berhasil dipindahkan ke ${targetPlatform}.` });
      fetchVouchers(); // Refresh data
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Pindahkan Voucher Antar Platform</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6 p-4 border rounded-lg">
          <div className="flex-1">
            <p className="font-semibold text-lg">{selectedVouchers.length} Voucher Dipilih</p>
            <p className="text-sm text-gray-500">Pilih voucher dari tabel di bawah ini.</p>
          </div>
          <ArrowRight className="hidden sm:block" />
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Pindahkan ke Platform</label>
            <Select value={targetPlatform} onValueChange={(value: Platform) => setTargetPlatform(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Platform Tujuan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LG">LG</SelectItem>
                <SelectItem value="wahyu">wahyu</SelectItem>
                <SelectItem value="Itemku">Itemku</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleMoveVouchers} disabled={loading || selectedVouchers.length === 0 || !targetPlatform}>
            {loading ? 'Memindahkan...' : 'Pindahkan Voucher'}
          </Button>
        </div>

        {loading && vouchers.length === 0 ? (
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
                <TableHead>Kode Voucher</TableHead>
                <TableHead>Platform Saat Ini</TableHead>
                <TableHead>Tanggal</TableHead>
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
                  <TableCell>{voucher.code}</TableCell>
                  <TableCell>{voucher.platform}</TableCell>
                  <TableCell>{new Date(voucher.tanggal + 'T00:00:00').toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
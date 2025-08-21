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
type NewVoucher = Database['public']['Tables']['vouchers']['Insert'];

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<NewVoucher>({
    tanggal: new Date().toISOString().split('T')[0],
    nominal: 0,
    code: '',
    platform: 'LG'
  });
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
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase
      .from('vouchers')
      .insert([formData]);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Voucher berhasil ditambahkan" });
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        nominal: 0,
        code: '',
        platform: 'LG'
      });
      fetchVouchers();
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Manajemen Voucher</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Tambah Voucher Baru</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal</label>
              <Input 
                type="date" 
                value={formData.tanggal}
                onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nominal</label>
              <Input 
                type="number" 
                value={formData.nominal}
                onChange={(e) => setFormData({...formData, nominal: Number(e.target.value)})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kode Voucher</label>
              <Input 
                type="text" 
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <Select 
                value={formData.platform}
                onValueChange={(value: "LG" | "wahyu" | "Itemku") => setFormData({...formData, platform: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LG">LG</SelectItem>
                  <SelectItem value="wahyu">wahyu</SelectItem>
                  <SelectItem value="Itemku">Itemku</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Voucher"}
          </Button>
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
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type NewVoucher = Database['public']['Tables']['vouchers']['Insert'];
type Platform = "LG" | "wahyu" | "Itemku";

const InputVouchersPage = () => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [codes, setCodes] = useState("");
  const [platform, setPlatform] = useState<Platform>("LG");
  const [nominal, setNominal] = useState("50000");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codes.trim()) {
      toast({
        title: "Error",
        description: "Kode voucher tidak boleh kosong.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const codeList = codes.trim().split('\n').filter(code => code.trim() !== '');
    
    const vouchersToInsert: NewVoucher[] = codeList.map(code => ({
      tanggal,
      code: code.trim(),
      platform,
      nominal: parseInt(nominal, 10),
    }));

    const { error } = await supabase
      .from('vouchers')
      .insert(vouchersToInsert);

    if (error) {
      toast({
        title: "Error",
        description: `Gagal menyimpan voucher: ${error.message}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${codeList.length} voucher berhasil disimpan.`,
      });
      setCodes("");
    }

    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Input Voucher Massal</CardTitle>
          <CardDescription>Masukkan data voucher pada form di bawah ini. Pisahkan setiap kode voucher dengan baris baru.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="tanggal-input" className="block text-sm font-medium mb-2 text-left">
                Tanggal
              </label>
              <Input
                id="tanggal-input"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="platform-select" className="block text-sm font-medium mb-2 text-left">
                Provider
              </label>
              <Select 
                value={platform}
                onValueChange={(value: Platform) => setPlatform(value)}
              >
                <SelectTrigger id="platform-select">
                  <SelectValue placeholder="Pilih Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LG">Lapakgaming</SelectItem>
                  <SelectItem value="wahyu">Wahyu</SelectItem>
                  <SelectItem value="Itemku">Itemku</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="nominal-select" className="block text-sm font-medium mb-2 text-left">
                Nominal
              </label>
              <Select 
                value={nominal}
                onValueChange={(value) => setNominal(value)}
              >
                <SelectTrigger id="nominal-select">
                  <SelectValue placeholder="Pilih Nominal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50000">50K</SelectItem>
                  <SelectItem value="65000">65K</SelectItem>
                  <SelectItem value="100000">100K</SelectItem>
                  <SelectItem value="200000">200K</SelectItem>
                  <SelectItem value="300000">300K</SelectItem>
                  <SelectItem value="500000">500K</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="codes-input" className="block text-sm font-medium mb-2 text-left">
                Kode Voucher
              </label>
              <Textarea
                id="codes-input"
                value={codes}
                onChange={(e) => setCodes(e.target.value)}
                placeholder="Contoh:&#10;CODE123&#10;CODE456&#10;CODE789"
                required
                rows={10}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? `Menyimpan ${codes.trim().split('\n').filter(c => c).length} voucher...` : "Simpan Voucher"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InputVouchersPage;
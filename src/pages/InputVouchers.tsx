"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowLeft } from "lucide-react"; // Import ArrowLeft
import { useNavigate } from "react-router-dom"; // Import useNavigate

type NewVoucher = Database['public']['Tables']['vouchers']['Insert'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
type Source = NonNullable<Database['public']['Tables']['vouchers']['Row']['source']>;

// Ukuran batch untuk setiap request ke database
const CHUNK_SIZE = 100;

const InputVouchersPage = () => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [codes, setCodes] = useState("");
  const [platform, setPlatform] = useState<Platform>("LG");
  const [source, setSource] = useState<Source | ''>('');
  const [nominal, setNominal] = useState("50000");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const { toast } = useToast();
  const navigate = useNavigate(); // Inisialisasi useNavigate

  const voucherCount = useMemo(() => {
    if (!codes.trim()) return 0;
    return codes.trim().split('\n').filter(code => code.trim() !== '').length;
  }, [codes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherCount === 0) {
      toast({ title: "Error", description: "Kode voucher tidak boleh kosong.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setProgress({ processed: 0, total: voucherCount });

    const codeList = codes.trim().split('\n').filter(code => code.trim() !== '');
    let successfulInserts = 0;

    for (let i = 0; i < codeList.length; i += CHUNK_SIZE) {
      const chunk = codeList.slice(i, i + CHUNK_SIZE);
      
      // 1. Periksa duplikasi untuk batch saat ini
      const { data: existingVouchers, error: checkError } = await supabase
        .from('vouchers')
        .select('code')
        .in('code', chunk);

      if (checkError) {
        toast({ title: "Error Pengecekan", description: `Gagal memeriksa duplikasi pada batch ${i / CHUNK_SIZE + 1}: ${checkError.message}`, variant: "destructive" });
        setLoading(false);
        return;
      }

      const duplicateCodes = existingVouchers?.map(v => v.code) || [];
      const uniqueCodesInChunk = chunk.filter(code => !duplicateCodes.includes(code));

      if (duplicateCodes.length > 0) {
        toast({ title: "Voucher Duplikat Dilewati", description: `${duplicateCodes.length} voucher di batch ini sudah ada dan akan dilewati.`, variant: "default" });
      }

      if (uniqueCodesInChunk.length === 0) {
        setProgress(prev => ({ ...prev, processed: prev.processed + chunk.length }));
        continue; // Lanjut ke batch berikutnya jika semua di batch ini duplikat
      }

      // 2. Siapkan data untuk di-insert
      const vouchersToInsert: NewVoucher[] = uniqueCodesInChunk.map(code => ({
        tanggal,
        code: code.trim(),
        platform,
        source: source || null,
        nominal: parseInt(nominal, 10),
      }));

      // 3. Insert batch saat ini
      const { error: insertError } = await supabase.from('vouchers').insert(vouchersToInsert);

      if (insertError) {
        toast({ title: "Error Penyimpanan", description: `Gagal menyimpan batch ${i / CHUNK_SIZE + 1}: ${insertError.message}`, variant: "destructive" });
        setLoading(false);
        return;
      }
      
      successfulInserts += uniqueCodesInChunk.length;
      setProgress(prev => ({ ...prev, processed: prev.processed + chunk.length }));
    }

    toast({ title: "Sukses", description: `${successfulInserts} dari ${voucherCount} voucher berhasil disimpan.` });
    setCodes("");
    setLoading(false);
  };

  const progressValue = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  return (
    <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Input Voucher Massal</CardTitle>
          </div>
          <CardDescription>Masukkan data voucher pada form di bawah ini. Pisahkan setiap kode voucher dengan baris baru.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tanggal-input" className="block text-sm font-medium mb-2 text-left">Tanggal</label>
                <Input id="tanggal-input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required disabled={loading} />
              </div>
              <div>
                <label htmlFor="nominal-select" className="block text-sm font-medium mb-2 text-left">Nominal</label>
                <Select value={nominal} onValueChange={(value) => setNominal(value)} disabled={loading}>
                  <SelectTrigger id="nominal-select"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
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
                <label htmlFor="platform-select" className="block text-sm font-medium mb-2 text-left">Provider (Platform)</label>
                <Select value={platform} onValueChange={(value: Platform) => setPlatform(value)} disabled={loading}>
                  <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih Provider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LG">Lapakgaming</SelectItem>
                    <SelectItem value="wahyu">Wahyu</SelectItem>
                    <SelectItem value="Itemku">Itemku</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="source-select" className="block text-sm font-medium mb-2 text-left">Source (Sumber Stok)</label>
                <Select value={source} onValueChange={(value: Source) => setSource(value)} disabled={loading}>
                  <SelectTrigger id="source-select"><SelectValue placeholder="Pilih Source (Opsional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paygift website">Paygift website</SelectItem>
                    <SelectItem value="Paygift Sales">Paygift Sales</SelectItem>
                    <SelectItem value="Tokopedia">Tokopedia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="codes-input" className="block text-sm font-medium text-left">Kode Voucher</label>
                <span className="text-sm text-muted-foreground">{voucherCount} voucher dimasukkan</span>
              </div>
              <Textarea id="codes-input" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="Contoh:&#10;CODE123&#10;CODE456&#10;CODE789" required rows={10} disabled={loading} />
            </div>
            {loading && (
              <div className="space-y-2">
                <Progress value={progressValue} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  Memproses {progress.processed} dari {progress.total} voucher...
                </p>
              </div>
            )}
            <Button type="submit" disabled={loading || voucherCount === 0} className="w-full">
              {loading ? `Sedang Memproses...` : `Simpan ${voucherCount > 0 ? `${voucherCount} ` : ''}Voucher`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InputVouchersPage;
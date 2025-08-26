"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type NewVoucher = Database['public']['Tables']['vouchers']['Insert'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
type Source = NonNullable<Database['public']['Tables']['vouchers']['Row']['source']>;

const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"];
const ALL_NOMINAL_OPTIONS_STR = ["100", "200", "400", "50000", "65000", "100000", "200000", "300000", "500000", "Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];

const formatNominalDisplay = (nominal: string | number) => {
  const strNominal = String(nominal);
  if (strNominal === "100") return "100 RBX";
  if (strNominal === "200") return "200 RBX";
  if (strNominal === "400") return "400 RBX";
  if (strNominal.includes("Random Steam Key")) return strNominal;

  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return numNominal.toLocaleString('id-ID') + 'K';
  }
  return strNominal;
};

const getFilteredNominalOptions = (platform: Platform | '') => {
  if (platform === "Itemku") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => !n.includes("Random Steam Key"));
  } else if (platform === "LG" || platform === "wahyu") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => ["50000", "65000", "200000"].includes(n));
  } else if (platform === "Itemku Steam Game Key") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => n.includes("Random Steam Key"));
  }
  return [];
};

// Ukuran batch untuk setiap request ke database
const CHUNK_SIZE = 100;

const InputVouchersPage = () => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [codes, setCodes] = useState("");
  const [platform, setPlatform] = useState<Platform>("LG");
  const [source, setSource] = useState<Source | ''>('');
  const [nominal, setNominal] = useState("50000"); // Default for LG
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const { toast } = useToast();
  const navigate = useNavigate();

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(platform), [platform]);

  useEffect(() => {
    // Reset nominal if the selected platform changes and the current nominal is no longer valid
    if (nominal && !filteredNominalOptions.includes(nominal)) {
      setNominal(filteredNominalOptions.length > 0 ? filteredNominalOptions[0] : '');
    } else if (!nominal && filteredNominalOptions.length > 0) {
      // Set a default if no nominal is selected and options are available
      setNominal(filteredNominalOptions[0]);
    }
  }, [platform, nominal, filteredNominalOptions]);

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
    if (!platform || !nominal) {
      toast({ title: "Error", description: "Harap pilih Platform dan Nominal.", variant: "destructive" });
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
        nominal: nominal, // Nominal sekarang string
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
                <Select value={nominal} onValueChange={(value) => setNominal(value)} disabled={loading || !platform}>
                  <SelectTrigger id="nominal-select"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
                  <SelectContent>
                    {filteredNominalOptions.map(n => (
                      <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="platform-select" className="block text-sm font-medium mb-2 text-left">Provider (Platform)</label>
                <Select value={platform} onValueChange={(value: Platform) => setPlatform(value)} disabled={loading}>
                  <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih Provider" /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                    <SelectItem value="Manual Adjustment">Manual Adjustment</SelectItem>
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
            <Button type="submit" disabled={loading || voucherCount === 0 || !platform || !nominal} className="w-full">
              {loading ? `Sedang Memproses...` : `Simpan ${voucherCount > 0 ? `${voucherCount} ` : ''}Voucher`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InputVouchersPage;
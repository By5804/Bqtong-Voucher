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
import { Label } from "@/components/ui/label"; // Import Label

type NewVoucher = Database['public']['Tables']['vouchers']['Insert'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
// Source sekarang adalah string | null
// type Source = NonNullable<Database['public']['Tables']['vouchers']['Row']['source']>; // Dihapus

const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"];
// sourceOptions dihapus karena sekarang input teks bebas
// const sourceOptions: Source[] = ["Paygift website", "Paygift Sales", "Tokopedia", "Manual Adjustment", "Random"];

const formatNominalDisplay = (nominal: string | number) => {
  const strNominal = String(nominal);
  if (["100", "200", "400", "500"].includes(strNominal)) {
    return `${strNominal} RBX`;
  }
  if (strNominal.includes("Random Steam Key")) {
    return strNominal;
  }
  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return `${numNominal.toLocaleString('id-ID')} IDR`;
  }
  return strNominal;
};

const getFilteredNominalOptions = (platform: Platform | '') => {
  if (platform === "Itemku") {
    return ["100", "200", "400", "500", "50000", "65000", "100000", "200000", "300000", "500000"]; // Added "500"
  } else if (platform === "LG" || platform === "wahyu") {
    return ["50000", "65000", "200000"];
  } else if (platform === "Itemku Steam Game Key") {
    return ["Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];
  }
  return [];
};

const CHUNK_SIZE = 100;

const InputVouchersPage = () => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [codes, setCodes] = useState("");
  const [platform, setPlatform] = useState<Platform>("LG");
  const [source, setSource] = useState<string>(''); // Source sekarang string
  const [nominal, setNominal] = useState("50000");
  const [invoice, setInvoice] = useState<string>(''); // State untuk invoice
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const { toast } = useToast();
  const navigate = useNavigate();

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(platform), [platform]);

  useEffect(() => {
    if (nominal && !filteredNominalOptions.includes(nominal)) {
      setNominal(filteredNominalOptions.length > 0 ? filteredNominalOptions[0] : '');
    } else if (!nominal && filteredNominalOptions.length > 0) {
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
      
      const vouchersToInsert: NewVoucher[] = chunk.map(code => ({
        tanggal,
        code: code.trim(),
        platform,
        source: source.trim() === '' ? null : source.trim(), // Simpan sebagai null jika kosong
        nominal: nominal,
        invoice: invoice.trim() === '' ? null : invoice.trim(), // Simpan invoice
      }));

      const { error: insertError } = await supabase
        .from('vouchers')
        .insert(vouchersToInsert);

      if (insertError) {
        toast({ title: "Error Penyimpanan", description: `Gagal menyimpan batch ${i / CHUNK_SIZE + 1}: ${insertError.message}`, variant: "destructive" });
        setLoading(false);
        return;
      }
      
      successfulInserts += chunk.length;
      setProgress(prev => ({ ...prev, processed: prev.processed + chunk.length }));
    }

    toast({ title: "Sukses", description: `${successfulInserts} dari ${voucherCount} voucher berhasil disimpan.` });
    setCodes("");
    setInvoice(""); // Reset invoice
    setSource(""); // Reset source
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
          <CardDescription>Masukkan data voucher pada form di bawah ini. Pisahkan setiap kode voucher dengan baris baru. Kode voucher akan disimpan sebagai teks biasa.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="tanggal-input" className="block text-sm font-medium mb-2 text-left">Tanggal</Label>
                <Input id="tanggal-input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required disabled={loading} />
              </div>
              <div>
                <Label htmlFor="nominal-select" className="block text-sm font-medium mb-2 text-left">Nominal</Label>
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
                <Label htmlFor="platform-select" className="block text-sm font-medium mb-2 text-left">Provider (Platform)</Label>
                <Select value={platform} onValueChange={(value: Platform) => setPlatform(value)} disabled={loading}>
                  <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih Provider" /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="source-input" className="block text-sm font-medium mb-2 text-left">Source (Sumber Stok) <span className="text-muted-foreground">(Opsional)</span></Label>
                <Input id="source-input" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Contoh: Paygift website, Tokopedia" disabled={loading} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="invoice-input" className="block text-sm font-medium mb-2 text-left">Nomor Invoice <span className="text-muted-foreground">(Opsional)</span></Label>
                <Input id="invoice-input" type="text" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Contoh: INV-20240801-001" disabled={loading} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="codes-input" className="block text-sm font-medium text-left">Kode Voucher</Label>
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
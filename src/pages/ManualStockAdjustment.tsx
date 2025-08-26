"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

type NewVoucher = Database['public']['Tables']['vouchers']['Insert'];
type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

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

const CHUNK_SIZE = 100;

const ManualStockAdjustmentPage = () => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [platform, setPlatform] = useState<Platform>("LG");
  const [nominal, setNominal] = useState("50000");
  const [quantity, setQuantity] = useState<number>(1);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform || !nominal || quantity <= 0) {
      toast({ title: "Error", description: "Harap isi semua field dengan benar.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setProgress({ processed: 0, total: quantity });

    let successfulInserts = 0;
    const currentTimestamp = Date.now();

    for (let i = 0; i < quantity; i += CHUNK_SIZE) {
      const chunkCount = Math.min(CHUNK_SIZE, quantity - i);
      const vouchersToInsert: NewVoucher[] = Array.from({ length: chunkCount }).map((_, idx) => ({
        tanggal,
        code: `MANUAL_ADJ_${platform}_${nominal}_${currentTimestamp}_${i + idx}`,
        platform,
        source: "Manual Adjustment",
        nominal: nominal,
        status: 'available',
      }));

      const { error: insertError } = await supabase.from('vouchers').insert(vouchersToInsert);

      if (insertError) {
        toast({ title: "Error Penyimpanan", description: `Gagal menyimpan batch ${i / CHUNK_SIZE + 1}: ${insertError.message}`, variant: "destructive" });
        setLoading(false);
        return;
      }
      
      successfulInserts += chunkCount;
      setProgress(prev => ({ ...prev, processed: prev.processed + chunkCount }));
    }

    toast({ title: "Sukses", description: `${successfulInserts} voucher berhasil ditambahkan secara manual.` });
    setQuantity(1);
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
            <CardTitle>Penyesuaian Stok Manual</CardTitle>
          </div>
          <CardDescription>Tambahkan jumlah stok voucher secara manual untuk platform dan nominal tertentu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="tanggal-input" className="block text-sm font-medium mb-2 text-left">Tanggal</label>
                <Input id="tanggal-input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required disabled={loading} />
              </div>
              <div>
                <label htmlFor="platform-select" className="block text-sm font-medium mb-2 text-left">Platform</label>
                <Select value={platform} onValueChange={(value: Platform) => setPlatform(value)} disabled={loading}>
                  <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <label htmlFor="quantity-input" className="block text-sm font-medium mb-2 text-left">Jumlah Voucher</label>
                <Input 
                  id="quantity-input" 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                  min="1" 
                  required 
                  disabled={loading} 
                />
              </div>
            </div>
            {loading && (
              <div className="space-y-2">
                <Progress value={progressValue} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  Memproses {progress.processed} dari {progress.total} voucher...
                </p>
              </div>
            )}
            <Button type="submit" disabled={loading || !platform || !nominal || quantity <= 0} className="w-full">
              {loading ? `Sedang Memproses...` : `Tambahkan ${quantity > 0 ? `${quantity} ` : ''}Voucher`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManualStockAdjustmentPage;
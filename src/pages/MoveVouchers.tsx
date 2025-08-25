"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];

const ALL_NOMINAL_OPTIONS_STR = ["100", "200", "50000", "65000", "100000", "200000", "300000", "500000"];

const formatNominalDisplay = (nominal: string) => {
  const numNominal = parseInt(nominal, 10);
  if (numNominal === 100) return "100 RBX";
  if (numNominal === 200) return "200 RBX";
  return (numNominal / 1000).toLocaleString('id-ID') + 'K';
};

const getFilteredNominalOptions = (platform: Platform | '') => {
  if (platform === "Itemku") {
    return ALL_NOMINAL_OPTIONS_STR;
  } else if (platform === "LG" || platform === "wahyu") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => parseInt(n, 10) >= 50000);
  }
  return [];
};

export default function MoveVouchersPage() {
  const [loading, setLoading] = useState(false);
  const [sourcePlatform, setSourcePlatform] = useState<Platform | ''>('');
  const [targetPlatform, setTargetPlatform] = useState<Platform | ''>('');
  const [nominal, setNominal] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(sourcePlatform), [sourcePlatform]);
  const availableTargetPlatforms = useMemo(() => platformOptions.filter(p => p !== sourcePlatform), [sourcePlatform]);

  const fetchAvailableStock = useCallback(async () => {
    if (sourcePlatform && nominal) {
      setLoading(true);
      const { count, error } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('platform', sourcePlatform)
        .eq('nominal', parseInt(nominal, 10))
        .eq('status', 'available');

      if (error) {
        toast({ title: "Error", description: `Gagal memuat stok: ${error.message}`, variant: "destructive" });
        setAvailableStock(null);
      } else {
        setAvailableStock(count || 0);
      }
      setLoading(false);
    } else {
      setAvailableStock(null);
    }
  }, [sourcePlatform, nominal, toast]);

  useEffect(() => {
    fetchAvailableStock();
  }, [fetchAvailableStock]);

  useEffect(() => {
    // Reset nominal and target platform if source platform changes
    setNominal('');
    setTargetPlatform('');
  }, [sourcePlatform]);

  const handleMoveVouchers = async () => {
    if (!sourcePlatform || !targetPlatform || !nominal || quantity <= 0) {
      toast({ title: "Error", description: "Harap isi semua field dengan benar.", variant: "destructive" });
      return;
    }
    if (sourcePlatform === targetPlatform) {
      toast({ title: "Error", description: "Platform sumber dan tujuan tidak boleh sama.", variant: "destructive" });
      return;
    }
    if (availableStock === null || quantity > availableStock) {
      toast({ title: "Error", description: `Jumlah pindah (${quantity}) melebihi stok tersedia (${availableStock}).`, variant: "destructive" });
      return;
    }

    setLoading(true);

    // 1. Ambil ID voucher tertua yang akan dipindahkan
    const { data: vouchersToMove, error: selectError } = await supabase
      .from('vouchers')
      .select('id')
      .eq('platform', sourcePlatform)
      .eq('nominal', parseInt(nominal, 10))
      .eq('status', 'available')
      .order('created_at', { ascending: true }) // FIFO
      .limit(quantity);

    if (selectError || !vouchersToMove || vouchersToMove.length === 0) {
      toast({ title: "Error", description: `Gagal mengambil data voucher untuk dipindahkan: ${selectError?.message || 'Tidak ada voucher ditemukan.'}`, variant: "destructive" });
      setLoading(false);
      return;
    }

    const voucherIds = vouchersToMove.map(v => v.id);

    // 2. Update platform untuk voucher yang terpilih
    const { error: updateError } = await supabase
      .from('vouchers')
      .update({ platform: targetPlatform })
      .in('id', voucherIds);

    if (updateError) {
      toast({ title: "Error", description: `Gagal memindahkan voucher: ${updateError.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${quantity} voucher berhasil dipindahkan ke ${targetPlatform}.` });
      // Reset form and refetch stock
      setQuantity(1);
      fetchAvailableStock();
    }
    setLoading(false);
  };

  const isMoveDisabled = loading || !sourcePlatform || !targetPlatform || !nominal || quantity <= 0 || (availableStock !== null && quantity > availableStock);

  return (
    <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Pindahkan Voucher Berdasarkan Jumlah</CardTitle>
          </div>
          <CardDescription>Pilih platform, nominal, dan jumlah untuk memindahkan voucher tertua (FIFO).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <Label htmlFor="source-platform">Dari Platform</Label>
                <Select value={sourcePlatform} onValueChange={(v: Platform) => setSourcePlatform(v)} required>
                  <SelectTrigger id="source-platform"><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
                  <SelectContent>
                    {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-center pt-6">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="target-platform">Ke Platform</Label>
                <Select value={targetPlatform} onValueChange={(v: Platform) => setTargetPlatform(v)} required disabled={!sourcePlatform}>
                  <SelectTrigger id="target-platform"><SelectValue placeholder="Pilih Tujuan" /></SelectTrigger>
                  <SelectContent>
                    {availableTargetPlatforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nominal-select">Nominal</Label>
                <Select value={nominal} onValueChange={setNominal} required disabled={!sourcePlatform}>
                  <SelectTrigger id="nominal-select"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
                  <SelectContent>
                    {filteredNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity-input">Jumlah Pindah</Label>
                <Input 
                  id="quantity-input" 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                  min="1" 
                  required 
                  disabled={!sourcePlatform || !nominal}
                />
              </div>
            </div>

            {availableStock !== null && (
              <p className="text-sm text-center text-muted-foreground">
                Stok tersedia untuk dipindahkan: <span className="font-bold">{availableStock}</span>
              </p>
            )}

            <Button onClick={handleMoveVouchers} disabled={isMoveDisabled} className="w-full">
              {loading ? "Memproses..." : `Pindahkan ${quantity} Voucher`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
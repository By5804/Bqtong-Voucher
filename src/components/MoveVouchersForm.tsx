"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useDenominations } from "@/contexts/DenominationContext";
import { formatNominalDisplay } from "@/lib/utils";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];

export const MoveVouchersForm = ({ onClose, onActionComplete }: { onClose: () => void; onActionComplete: () => void; }) => {
  const [loading, setLoading] = useState(false);
  const [sourcePlatform, setSourcePlatform] = useState<Platform | ''>('');
  const [targetPlatform, setTargetPlatform] = useState<Platform | ''>('');
  const [sourceNominal, setSourceNominal] = useState<string>('');
  const [targetNominal, setTargetNominal] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { platforms: denominationPlatforms, getDenominationsForPlatform, loading: loadingDenominations } = useDenominations();

  const platformOptions = useMemo(() => denominationPlatforms.map(p => p.platform_name), [denominationPlatforms]);
  const sourceNominalOptions = useMemo(() => getDenominationsForPlatform(sourcePlatform as string), [sourcePlatform, getDenominationsForPlatform]);
  const targetNominalOptions = useMemo(() => getDenominationsForPlatform(targetPlatform as string), [targetPlatform, getDenominationsForPlatform]);

  const fetchAvailableStock = useCallback(async () => {
    if (sourcePlatform && sourceNominal) {
      setLoading(true);
      const { count, error } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('platform', sourcePlatform)
        .eq('nominal', sourceNominal)
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
  }, [sourcePlatform, sourceNominal, toast]);

  useEffect(() => {
    fetchAvailableStock();
  }, [fetchAvailableStock]);

  useEffect(() => { setSourceNominal(''); }, [sourcePlatform]);
  useEffect(() => { setTargetNominal(''); }, [targetPlatform]);

  const handleMoveVouchers = async () => {
    if (!sourcePlatform || !targetPlatform || !sourceNominal || !targetNominal || quantity <= 0) {
      toast({ title: "Error", description: "Harap isi semua field dengan benar.", variant: "destructive" });
      return;
    }
    if (sourcePlatform === targetPlatform && sourceNominal === targetNominal) {
      toast({ title: "Error", description: "Sumber dan tujuan tidak boleh sama.", variant: "destructive" });
      return;
    }
    if (availableStock === null || quantity > availableStock) {
      toast({ title: "Error", description: `Jumlah pindah (${quantity}) melebihi stok tersedia (${availableStock}).`, variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data: vouchersToMove, error: selectError } = await supabase
      .from('vouchers')
      .select('id')
      .eq('platform', sourcePlatform)
      .eq('nominal', sourceNominal)
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .limit(quantity);

    if (selectError || !vouchersToMove || vouchersToMove.length === 0) {
      toast({ title: "Error", description: `Gagal mengambil data voucher untuk dipindahkan: ${selectError?.message || 'Tidak ada voucher ditemukan.'}`, variant: "destructive" });
      setLoading(false);
      return;
    }

    const voucherIds = vouchersToMove.map(v => v.id);

    const { error: updateError } = await supabase
      .from('vouchers')
      .update({ platform: targetPlatform, nominal: targetNominal })
      .in('id', voucherIds);

    if (updateError) {
      toast({ title: "Error", description: `Gagal memindahkan voucher: ${updateError.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${quantity} voucher berhasil dipindahkan ke ${targetPlatform} - ${formatNominalDisplay(targetNominal, targetPlatform)}.` });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const isMoveDisabled = loading || loadingDenominations || !sourcePlatform || !targetPlatform || !sourceNominal || !targetNominal || quantity <= 0 || (availableStock !== null && quantity > availableStock);

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg space-y-3">
        <h4 className="font-semibold text-sm">Sumber</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="source-platform">Platform</Label>
            <Select value={sourcePlatform} onValueChange={(v: Platform) => setSourcePlatform(v)} required disabled={loadingDenominations}>
              <SelectTrigger id="source-platform"><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
              <SelectContent>
                {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="source-nominal">Nominal</Label>
            <Select value={sourceNominal} onValueChange={setSourceNominal} required disabled={!sourcePlatform || loadingDenominations}>
              <SelectTrigger id="source-nominal"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
              <SelectContent>
                {sourceNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n, sourcePlatform)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {availableStock !== null && (
          <p className="text-xs text-muted-foreground">Stok tersedia: <span className="font-bold">{availableStock}</span></p>
        )}
      </div>

      <div className="flex justify-center">
        <ArrowDown className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="p-4 border rounded-lg space-y-3">
        <h4 className="font-semibold text-sm">Tujuan</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="target-platform">Platform</Label>
            <Select value={targetPlatform} onValueChange={(v: Platform) => setTargetPlatform(v)} required disabled={loadingDenominations}>
              <SelectTrigger id="target-platform"><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
              <SelectContent>
                {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="target-nominal">Nominal</Label>
            <Select value={targetNominal} onValueChange={setTargetNominal} required disabled={!targetPlatform || loadingDenominations}>
              <SelectTrigger id="target-nominal"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
              <SelectContent>
                {targetNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n, targetPlatform)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
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
          disabled={!sourcePlatform || !sourceNominal}
        />
      </div>

      <Button onClick={handleMoveVouchers} disabled={isMoveDisabled} className="w-full">
        {loading || loadingDenominations ? "Memproses..." : `Pindahkan ${quantity} Voucher`}
      </Button>
    </div>
  );
};
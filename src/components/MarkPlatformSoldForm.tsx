"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { useDenominations } from "@/contexts/DenominationContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const MarkPlatformSoldForm = ({ onClose, onActionComplete }: { onClose: () => void; onActionComplete: () => void; }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [vouchersToMarkCount, setVouchersToMarkCount] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();

  const platformOptions = useMemo(() => denominationPlatforms.map(p => p.platform_name), [denominationPlatforms]);

  const fetchVoucherCount = useCallback(async () => {
    if (!selectedPlatform) {
      setVouchersToMarkCount(null);
      return;
    }
    setLoading(true);
    const { count, error } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('platform', selectedPlatform)
      .eq('status', 'available');

    if (error) {
      toast({ title: "Error", description: `Gagal memuat jumlah voucher: ${error.message}`, variant: "destructive" });
      setVouchersToMarkCount(null);
    } else {
      setVouchersToMarkCount(count || 0);
    }
    setLoading(false);
  }, [selectedPlatform, toast]);

  useEffect(() => {
    fetchVoucherCount();
  }, [fetchVoucherCount]);

  const handleMarkPlatformSold = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('mark-platform-sold', {
      body: { platform: selectedPlatform },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memproses: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: data.message });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const isConfirmationDisabled = loading || loadingDenominations || !selectedPlatform || vouchersToMarkCount === null || vouchersToMarkCount === 0;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="platform-select">Pilih Platform</Label>
        <Select value={selectedPlatform} onValueChange={setSelectedPlatform} required disabled={loadingDenominations || loading}>
          <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih platform yang akan diproses" /></SelectTrigger>
          <SelectContent>
            {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedPlatform && (
        <div className="p-4 border rounded-lg text-center">
          {loading ? (
            <p>Menghitung voucher...</p>
          ) : vouchersToMarkCount !== null ? (
            <p>Terdapat <span className="font-bold text-lg">{vouchersToMarkCount}</span> voucher tersedia yang akan ditandai terjual.</p>
          ) : (
            <p className="text-muted-foreground">Pilih platform untuk melihat jumlah voucher.</p>
          )}
        </div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isConfirmationDisabled} className="w-full" variant="destructive">
            {loading || loadingDenominations ? "Memproses..." : `Tandai Semua ${vouchersToMarkCount || ''} Voucher Terjual`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Aksi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menandai semua <span className="font-bold">{vouchersToMarkCount}</span> voucher yang tersedia di platform <span className="font-bold">"{selectedPlatform}"</span> sebagai terjual. Tindakan ini tidak dapat dibatalkan. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPlatformSold}>Ya, Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
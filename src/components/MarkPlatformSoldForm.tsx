"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { useDenominations } from "@/contexts/DenominationContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const MarkPlatformSoldForm = ({ onClose, onActionComplete }: { onClose: () => void; onActionComplete: () => void; }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [internalStock, setInternalStock] = useState<number | null>(null);
  const [externalStock, setExternalStock] = useState<number | 'N/A' | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();

  const platformOptions = useMemo(() => denominationPlatforms.map(p => p.platform_name), [denominationPlatforms]);

  const fetchStockDetails = useCallback(async () => {
    if (!selectedPlatform) {
      setInternalStock(null);
      setExternalStock(null);
      return;
    }
    setLoadingDetails(true);
    setInternalStock(null);
    setExternalStock(null);

    // Fetch internal and external stock in parallel
    const [internalResult, externalResult] = await Promise.all([
      supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('platform', selectedPlatform)
        .eq('status', 'available'),
      supabase.functions.invoke('get-platform-external-stock', {
        body: { platform: selectedPlatform },
      })
    ]);

    // Handle internal stock result
    if (internalResult.error) {
      toast({ title: "Error", description: `Gagal memuat stok internal: ${internalResult.error.message}`, variant: "destructive" });
      setInternalStock(0);
    } else {
      setInternalStock(internalResult.count || 0);
    }

    // Handle external stock result
    if (externalResult.error) {
      toast({ title: "Error", description: `Gagal memuat stok eksternal: ${externalResult.error.message}`, variant: "destructive" });
      setExternalStock('N/A');
    } else {
      setExternalStock(externalResult.data.totalStock);
    }

    setLoadingDetails(false);
  }, [selectedPlatform, toast]);

  useEffect(() => {
    fetchStockDetails();
  }, [fetchStockDetails]);

  const handleMarkPlatformSold = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('mark-platform-sold', {
      body: { platform: selectedPlatform },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memproses: ${error.message}`, variant: "destructive" });
    } else {
      toast({ 
        title: "Sukses", 
        description: `${data.message} Sisa stok internal: 0.`
      });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const vouchersToMarkCount = internalStock ?? 0;
  const isConfirmationDisabled = loading || loadingDenominations || !selectedPlatform || vouchersToMarkCount === 0;

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
        <div className="p-4 border rounded-lg space-y-2">
          <h4 className="text-sm font-semibold text-center mb-2">Ringkasan Stok</h4>
          {loadingDetails ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Stok Eksternal (EXT)</span>
                <span className="font-bold text-lg">{externalStock ?? '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Stok Internal (INT)</span>
                <span className="font-bold text-lg">{internalStock ?? '-'}</span>
              </div>
            </>
          )}
        </div>
      )}
      
      {vouchersToMarkCount > 0 && !loadingDetails && (
        <div className="p-4 border rounded-lg text-center bg-yellow-50 border-yellow-200">
            <p>Akan menandai <span className="font-bold text-lg text-yellow-800">{vouchersToMarkCount}</span> voucher tersedia sebagai terjual.</p>
        </div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isConfirmationDisabled} className="w-full" variant="destructive">
            {loading || loadingDenominations ? "Memproses..." : `Tandai Semua ${vouchersToMarkCount > 0 ? vouchersToMarkCount : ''} Voucher Terjual`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Aksi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menandai semua <span className="font-bold">{vouchersToMarkCount}</span> voucher yang tersedia di platform <span className="font-bold">"{selectedPlatform}"</span> sebagai terjual.
              <div className="mt-4 space-y-1 text-sm">
                <p>Stok Eksternal: <span className="font-semibold">{externalStock ?? 'N/A'}</span></p>
                <p>Stok Internal: <span className="font-semibold">{internalStock ?? 'N/A'}</span></p>
              </div>
              <p className="mt-2">Tindakan ini tidak dapat dibatalkan. Lanjutkan?</p>
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
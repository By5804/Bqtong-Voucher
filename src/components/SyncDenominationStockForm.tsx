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
import { RefreshCw } from "lucide-react";
import { formatNominalDisplay } from "@/lib/utils";

export const SyncDenominationStockForm = ({ onClose, onActionComplete }: { onClose: () => void; onActionComplete: () => void; }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedNominal, setSelectedNominal] = useState<string>('');
  const [internalStock, setInternalStock] = useState<number | null>(null);
  const [externalStock, setExternalStock] = useState<number | 'N/A' | 'loading' | null>(null);
  const [loadingStockDetails, setLoadingStockDetails] = useState(false);
  
  const { toast } = useToast();
  const { platforms: denominationPlatforms, getDenominationsForPlatform, loading: loadingDenominations } = useDenominations();

  const platformOptions = useMemo(() => denominationPlatforms.map(p => p.platform_name), [denominationPlatforms]);
  const nominalOptions = useMemo(() => getDenominationsForPlatform(selectedPlatform), [selectedPlatform, getDenominationsForPlatform]);
  const isExternalStockEnabled = useMemo(() => {
    const platform = denominationPlatforms.find(p => p.platform_name === selectedPlatform);
    return platform?.is_external_stock_enabled ?? false;
  }, [selectedPlatform, denominationPlatforms]);

  const fetchStockDetails = useCallback(async () => {
    if (!selectedPlatform || !selectedNominal) {
      setInternalStock(null);
      setExternalStock(null);
      return;
    }
    setLoadingStockDetails(true);
    setInternalStock(null);
    setExternalStock(isExternalStockEnabled ? 'loading' : 'N/A');

    // Fetch internal stock
    const { count: internalCount, error: internalError } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('platform', selectedPlatform)
      .eq('nominal', selectedNominal)
      .eq('status', 'available');

    if (internalError) {
      toast({ title: "Error", description: `Gagal memuat stok internal: ${internalError.message}`, variant: "destructive" });
      setInternalStock(null);
    } else {
      setInternalStock(internalCount || 0);
    }

    // Fetch external stock if enabled
    if (isExternalStockEnabled) {
      try {
        const { data, error } = await supabase.functions.invoke('check-external-stock', {
          body: { platform: selectedPlatform, nominal: selectedNominal },
        });

        if (error) {
          console.error(`Frontend error for ${selectedPlatform} ${selectedNominal}:`, error);
          if (error.status === 404 && error.context?.body) {
              const errorBody = JSON.parse(error.context.body);
              toast({ title: "Error", description: errorBody.error, variant: "destructive" });
          } else {
              toast({ title: "Error", description: `Gagal memuat stok eksternal untuk ${selectedPlatform} ${formatNominalDisplay(selectedNominal, selectedPlatform)}: ${error.message}`, variant: "destructive" });
          }
          setExternalStock('N/A');
        } else {
          setExternalStock(data.stock);
        }
      } catch (err: any) {
        console.error(`General catch error for ${selectedPlatform} ${selectedNominal}:`, err);
        toast({ title: "Error", description: `Terjadi kesalahan saat memuat stok eksternal untuk ${selectedPlatform} ${formatNominalDisplay(selectedNominal, selectedPlatform)}: ${err.message}`, variant: "destructive" });
        setExternalStock('N/A');
      }
    } else {
      setExternalStock('N/A');
    }

    setLoadingStockDetails(false);
  }, [selectedPlatform, selectedNominal, isExternalStockEnabled, toast]);

  useEffect(() => {
    fetchStockDetails();
  }, [fetchStockDetails]);

  useEffect(() => {
    setSelectedNominal(''); // Reset nominal when platform changes
  }, [selectedPlatform]);

  const handleSyncDenominationStock = async () => {
    if (internalStock === null || externalStock === null || externalStock === 'N/A' || externalStock === 'loading') {
      toast({ title: "Error", description: "Stok tidak valid untuk disinkronkan.", variant: "destructive" });
      return;
    }

    const quantityToMarkSold = internalStock - externalStock;

    if (quantityToMarkSold <= 0) {
      toast({ title: "Info", description: "Stok internal sudah sama atau lebih rendah dari stok eksternal. Tidak ada yang perlu ditandai terjual.", variant: "default" });
      onClose();
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('mark-vouchers-sold', {
      body: { platform: selectedPlatform, nominal: selectedNominal, quantity: quantityToMarkSold },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memproses: ${error.message}`, variant: "destructive" });
    } else {
      toast({ 
        title: "Sukses", 
        description: `${data.updatedCount} voucher berhasil ditandai terjual untuk menyamakan stok ${formatNominalDisplay(selectedNominal, selectedPlatform)} di platform ${selectedPlatform}.`
      });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const vouchersToSyncCount = useMemo(() => {
    if (internalStock === null || externalStock === null || typeof externalStock !== 'number') {
      return 0;
    }
    const diff = internalStock - externalStock;
    return diff > 0 ? diff : 0;
  }, [internalStock, externalStock]);

  const isConfirmationDisabled = loading || loadingDenominations || loadingStockDetails || !selectedPlatform || !selectedNominal || vouchersToSyncCount === 0;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="platform-select">Pilih Platform</Label>
        <Select value={selectedPlatform} onValueChange={setSelectedPlatform} required disabled={loadingDenominations || loading}>
          <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih platform" /></SelectTrigger>
          <SelectContent>
            {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="nominal-select">Pilih Nominal</Label>
        <Select value={selectedNominal} onValueChange={setSelectedNominal} required disabled={loadingDenominations || loading || !selectedPlatform}>
          <SelectTrigger id="nominal-select"><SelectValue placeholder="Pilih nominal" /></SelectTrigger>
          <SelectContent>
            {nominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n, selectedPlatform)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedPlatform && selectedNominal && (
        <div className="p-4 border rounded-lg space-y-2">
          <h4 className="text-sm font-semibold text-center mb-2">Ringkasan Stok {formatNominalDisplay(selectedNominal, selectedPlatform)}</h4>
          {loadingStockDetails ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Stok Eksternal (EXT):</span>
                {externalStock === null ? (
                  <span className="text-sm text-muted-foreground">N/A</span>
                ) : externalStock === 'loading' ? (
                  <Skeleton className="h-4 w-12" />
                ) : (
                  <span className="font-semibold text-lg">{externalStock}</span>
                )}
                {isExternalStockEnabled && (
                  <Button 
                    onClick={fetchStockDetails} 
                    disabled={loadingStockDetails}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-xs"
                  >
                    {loadingStockDetails ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Stok Internal (INT):</span>
                <span className="font-semibold text-lg">{internalStock ?? 'N/A'}</span>
              </div>
            </>
          )}
        </div>
      )}
      
      {vouchersToSyncCount > 0 && !loadingStockDetails && (
        <div className="p-4 border rounded-lg text-center bg-blue-50 border-blue-200">
            <p>Akan menandai <span className="font-bold text-lg text-blue-800">{vouchersToSyncCount}</span> voucher sebagai terjual untuk menyamakan stok.</p>
        </div>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isConfirmationDisabled} className="w-full" variant="default">
            {loading || loadingDenominations || loadingStockDetails ? "Memproses..." : `Samakan Stok (${vouchersToSyncCount} Voucher)`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Sinkronisasi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menandai <span className="font-bold">{vouchersToSyncCount}</span> voucher <span className="font-bold">{formatNominalDisplay(selectedNominal, selectedPlatform)}</span> di platform <span className="font-bold">"{selectedPlatform}"</span> sebagai terjual untuk menyamakan stok internal dengan stok eksternal.
              <div className="mt-4 space-y-1 text-sm">
                <p>Stok Eksternal: <span className="font-semibold">{externalStock ?? 'N/A'}</span></p>
                <p>Stok Internal: <span className="font-semibold">{internalStock ?? 'N/A'}</span></p>
              </div>
              <p className="mt-2">Tindakan ini tidak dapat dibatalkan. Lanjutkan?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleSyncDenominationStock}>Ya, Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
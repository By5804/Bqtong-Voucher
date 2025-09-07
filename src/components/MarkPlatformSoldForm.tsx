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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNominalDisplay } from "@/lib/utils";

type StockBreakdown = {
  nominal: string;
  internal: number;
  external: number | 'N/A' | 'loading';
};

type StockTotals = {
  internal: number;
  external: number | 'N/A';
};

export const MarkPlatformSoldForm = ({ onClose, onActionComplete }: { onClose: () => void; onActionComplete: () => void; }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [stockBreakdown, setStockBreakdown] = useState<StockBreakdown[]>([]);
  const [stockTotals, setStockTotals] = useState<StockTotals | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const { toast } = useToast();
  const { platforms: denominationPlatforms, loading: loadingDenominations } = useDenominations();

  const platformOptions = useMemo(() => denominationPlatforms.map(p => p.platform_name), [denominationPlatforms]);

  const fetchStockDetails = useCallback(async () => {
    if (!selectedPlatform) {
      setStockBreakdown([]);
      setStockTotals(null);
      return;
    }
    setLoadingDetails(true);
    setStockBreakdown([]);
    setStockTotals(null);

    const { data, error } = await supabase.functions.invoke('get-platform-stock-breakdown', {
      body: { platform: selectedPlatform },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memuat rincian stok: ${error.message}`, variant: "destructive" });
    } else {
      setStockBreakdown(data.breakdown || []);
      setStockTotals(data.totals || { internal: 0, external: 0 });
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
        description: data.message
      });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const vouchersToMarkCount = stockTotals?.internal ?? 0;
  const isConfirmationDisabled = loading || loadingDenominations || !selectedPlatform || vouchersToMarkCount === 0 || loadingDetails;

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
              <Skeleton className="h-20 w-full mt-2" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center font-bold text-lg border-b pb-2 mb-2">
                <span>Total Eksternal (EXT)</span>
                <span>{stockTotals?.external ?? '-'}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total Internal (INT)</span>
                <span>{stockTotals?.internal ?? '-'}</span>
              </div>
              {stockBreakdown.length > 0 && (
                <div className="pt-2 max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8">Denom</TableHead>
                        <TableHead className="h-8 text-right">EXT</TableHead>
                        <TableHead className="h-8 text-right">INT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockBreakdown.map(item => (
                        <TableRow key={item.nominal}>
                          <TableCell className="py-1">{formatNominalDisplay(item.nominal, selectedPlatform)}</TableCell>
                          <TableCell className="py-1 text-right">{item.external}</TableCell>
                          <TableCell className="py-1 text-right font-semibold">{item.internal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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
            {loading || loadingDenominations || loadingDetails ? "Memproses..." : `Tandai Semua ${vouchersToMarkCount > 0 ? vouchersToMarkCount : ''} Voucher Terjual`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Aksi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menandai semua <span className="font-bold">{vouchersToMarkCount}</span> voucher yang tersedia di platform <span className="font-bold">"{selectedPlatform}"</span> sebagai terjual.
              <div className="mt-4 space-y-1 text-sm">
                <p>Total Stok Eksternal: <span className="font-semibold">{stockTotals?.external ?? 'N/A'}</span></p>
                <p>Total Stok Internal: <span className="font-semibold">{stockTotals?.internal ?? 'N/A'}</span></p>
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
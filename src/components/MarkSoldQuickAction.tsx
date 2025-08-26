"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Tag, RefreshCw } from "lucide-react"; // Import RefreshCw for loading spinner
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];
const ALL_NOMINAL_OPTIONS_STR = ["100", "200", "400", "50000", "65000", "100000", "200000", "300000", "500000"];

const formatNominalDisplay = (nominal: string) => {
  const numNominal = parseInt(nominal, 10);
  if (numNominal === 100) return "100 RBX";
  if (numNominal === 200) return "200 RBX";
  if (numNominal === 400) return "400 RBX";
  return numNominal.toLocaleString('id-ID') + 'K';
};

const getFilteredNominalOptions = (platform: Platform | '') => {
  if (platform === "Itemku") {
    return ALL_NOMINAL_OPTIONS_STR;
  } else if (platform === "LG" || platform === "wahyu") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => [50000, 65000, 200000].includes(parseInt(n, 10)));
  }
  return [];
};

const UpdateSoldVouchersForm = ({ onClose, onActionComplete }: { onClose: () => void; onActionComplete: () => void; }) => {
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [nominal, setNominal] = useState<string | ''>('');
  const [loading, setLoading] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [externalStock, setExternalStock] = useState<number | 'N/A' | 'loading' | null>(null);
  const [loadingExternalStock, setLoadingExternalStock] = useState(false);
  const [remainingStockInput, setRemainingStockInput] = useState<string>(''); // User input for stock on platform
  const [quantityToMarkSold, setQuantityToMarkSold] = useState<number>(1); // The actual quantity to submit
  const [isQuantityCalculated, setIsQuantityCalculated] = useState(false); // To control readOnly state
  const { toast } = useToast();

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(platform), [platform]);

  const fetchAvailableStock = useCallback(async () => {
    if (platform && nominal) {
      setLoading(true);
      const { count, error } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('platform', platform)
        .eq('nominal', parseInt(nominal, 10))
        .eq('status', 'available');

      if (error) {
        console.error("Error fetching available stock:", error.message);
        toast({ title: "Error", description: `Gagal memuat stok tersedia: ${error.message}`, variant: "destructive" });
        setAvailableStock(null);
      } else {
        setAvailableStock(count || 0);
      }
      setLoading(false);
    } else {
      setAvailableStock(null);
    }
  }, [platform, nominal, toast]);

  const fetchExternalStock = useCallback(async () => {
    // Handle Wahyu first, regardless of nominal selection
    if (platform === "wahyu") {
      setExternalStock('N/A');
      setLoadingExternalStock(false);
      return;
    }

    // If platform or nominal is not selected for other platforms, set to null
    if (!platform || !nominal) {
      setExternalStock(null);
      setLoadingExternalStock(false); // Ensure loading is false
      return;
    }

    setLoadingExternalStock(true);
    setExternalStock('loading');
    try {
      const { data, error } = await supabase.functions.invoke('check-external-stock', {
        body: { platform, nominal: parseInt(nominal, 10) },
      });

      if (error) {
        console.error(`Frontend error for ${platform} ${nominal}:`, error);
        if (error.status === 404 && error.context?.body) {
            const errorBody = JSON.parse(error.context.body);
            toast({ title: "Error", description: errorBody.error, variant: "destructive" });
        } else {
            toast({ title: "Error", description: `Gagal memuat stok eksternal untuk ${platform} ${formatNominalDisplay(nominal)}: ${error.message}`, variant: "destructive" });
        }
        setExternalStock('N/A');
      } else {
        setExternalStock(data.stock);
      }
    } catch (err: any) {
      console.error(`General catch error for ${platform} ${nominal}:`, err);
      toast({ title: "Error", description: `Terjadi kesalahan saat memuat stok eksternal untuk ${platform} ${formatNominalDisplay(nominal)}: ${err.message}`, variant: "destructive" });
      setExternalStock('N/A');
    } finally {
      setLoadingExternalStock(false);
    }
  }, [platform, nominal, toast]);

  useEffect(() => {
    // Reset nominal if the selected platform changes and the current nominal is no longer valid
    if (nominal && !filteredNominalOptions.includes(nominal)) {
      setNominal(filteredNominalOptions.length > 0 ? filteredNominalOptions[0] : '');
    } else if (!nominal && filteredNominalOptions.length > 0) {
      // Set a default if no nominal is selected and options are available
      setNominal(filteredNominalOptions[0]);
    }
    fetchAvailableStock();
    fetchExternalStock(); // Fetch external stock when platform/nominal changes
    setRemainingStockInput(''); // Clear remaining stock input on platform/nominal change
    setQuantityToMarkSold(1); // Reset quantity to 1
    setIsQuantityCalculated(false); // Reset calculation status
  }, [platform, nominal, filteredNominalOptions, fetchAvailableStock, fetchExternalStock]);

  useEffect(() => {
    if (availableStock !== null && remainingStockInput !== '') {
      const parsedRemaining = parseInt(remainingStockInput, 10);
      if (!isNaN(parsedRemaining) && parsedRemaining >= 0) {
        const calculatedQuantity = availableStock - parsedRemaining;
        if (calculatedQuantity >= 0) {
          setQuantityToMarkSold(calculatedQuantity);
          setIsQuantityCalculated(true);
        } else {
          toast({
            title: "Peringatan",
            description: "Sisa stok di platform lebih besar dari stok di database. Harap periksa kembali.",
            variant: "destructive"
          });
          setQuantityToMarkSold(0);
          setIsQuantityCalculated(true);
        }
      } else {
        // Invalid remainingStockInput, revert to manual quantity
        setIsQuantityCalculated(false);
      }
    } else if (remainingStockInput === '') {
      // If remainingStockInput is cleared, allow manual input for quantityToMarkSold
      setIsQuantityCalculated(false);
      // Do not reset quantityToMarkSold here, let it retain its last manual value or default to 1 if it was previously calculated.
      if (isQuantityCalculated) { // Only reset if it was previously calculated
        setQuantityToMarkSold(1);
      }
    }
  }, [availableStock, remainingStockInput, toast, isQuantityCalculated]);

  const handleQuantityChange = (value: number) => {
    // If user manually changes quantityToMarkSold, clear remainingStockInput and disable calculation
    setRemainingStockInput('');
    setIsQuantityCalculated(false);
    setQuantityToMarkSold(value);
  };

  const handleRemainingStockInputChange = (value: string) => {
    setRemainingStockInput(value);
    // The useEffect above will handle updating quantityToMarkSold and isQuantityCalculated
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform || !nominal || quantityToMarkSold <= 0) {
      toast({ title: "Error", description: "Harap isi semua field dengan benar dan pastikan jumlah terjual valid.", variant: "destructive" });
      return;
    }
    if (availableStock !== null && quantityToMarkSold > availableStock) {
      toast({ title: "Error", description: `Jumlah terjual (${quantityToMarkSold}) melebihi stok tersedia (${availableStock}).`, variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke('mark-vouchers-sold', {
      body: { platform, nominal: parseInt(nominal, 10), quantity: quantityToMarkSold },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal mengupdate: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: data.message });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const handleMatchStock = async () => {
    if (!platform || !nominal || availableStock === null || externalStock === null || externalStock === 'N/A' || externalStock === 'loading') {
      toast({ title: "Error", description: "Harap pilih platform dan nominal, dan pastikan stok eksternal sudah dimuat.", variant: "destructive" });
      return;
    }

    if (typeof externalStock !== 'number') {
      toast({ title: "Error", description: "Stok eksternal tidak valid.", variant: "destructive" });
      return;
    }

    if (externalStock >= availableStock) {
      toast({ title: "Info", description: "Stok internal sudah sama atau lebih rendah dari stok eksternal. Tidak ada yang perlu ditandai terjual.", variant: "default" });
      return;
    }

    const quantityToMarkSoldCalculated = availableStock - externalStock;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('mark-vouchers-sold', {
      body: { platform, nominal: parseInt(nominal, 10), quantity: quantityToMarkSoldCalculated },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal mengupdate: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `${data.updatedCount} voucher berhasil ditandai terjual untuk menyamakan stok.` });
      onActionComplete();
      onClose();
    }
    setLoading(false);
  };

  const isSubmitDisabled = loading || !platform || !nominal || quantityToMarkSold <= 0 || (availableStock !== null && quantityToMarkSold > availableStock);
  const isMatchStockDisabled = loading || loadingExternalStock || !platform || !nominal || availableStock === null || externalStock === null || externalStock === 'N/A' || externalStock === 'loading' || (typeof externalStock === 'number' && externalStock >= availableStock);

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
      <div>
        <Label className="block text-sm font-medium mb-1">Platform</Label>
        <Select value={platform} onValueChange={(v: Platform) => setPlatform(v)} required disabled={loading}>
          <SelectTrigger><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
          <SelectContent>
            {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="block text-sm font-medium mb-1">Nominal</Label>
        <Select value={nominal} onValueChange={setNominal} required disabled={loading || !platform}>
          <SelectTrigger><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
          <SelectContent>
            {filteredNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label className="block text-sm font-medium mb-1">
          Stok Tersedia di Database: {availableStock !== null ? availableStock : 'Memuat...'}
        </Label>
      </div>
      <div className="md:col-span-2">
        <Label className="block text-sm font-medium mb-1">
          Stok Eksternal: 
          {externalStock === null ? (
            <span className="text-sm text-muted-foreground ml-2">Pilih Platform & Nominal</span>
          ) : externalStock === 'loading' ? (
            <Skeleton className="h-4 w-16 inline-block align-middle ml-2" />
          ) : (
            <span className="font-semibold ml-2">{externalStock}</span>
          )}
        </Label>
      </div>
      <div className="md:col-span-2">
        <Label className="block text-sm font-medium mb-1">Sisa Stok di Platform (Opsional)</Label>
        <Input 
          type="number" 
          value={remainingStockInput} 
          onChange={e => handleRemainingStockInputChange(e.target.value)} 
          min="0" 
          placeholder="Masukkan sisa stok di platform"
          disabled={loading} 
        />
      </div>
      <div className="md:col-span-2">
        <Label className="block text-sm font-medium mb-1">Jumlah Terjual</Label>
        <Input 
          type="number" 
          value={quantityToMarkSold} 
          onChange={e => handleQuantityChange(Math.max(0, parseInt(e.target.value) || 0))} 
          min="0" 
          required 
          disabled={loading || isQuantityCalculated} // Disable if calculated
          readOnly={isQuantityCalculated} // Make readOnly if calculated
        />
      </div>
      <Button type="submit" disabled={isSubmitDisabled} className="w-full md:col-span-2">
        {loading ? "Memproses..." : "Update Terjual"}
      </Button>
      <Button 
        type="button" 
        onClick={handleMatchStock} 
        disabled={isMatchStockDisabled}
        className="w-full md:col-span-2 bg-blue-600 hover:bg-blue-700"
      >
        {loadingExternalStock ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Memuat Stok Eksternal...
          </>
        ) : (
          "Samakan Stok dengan Eksternal"
        )}
      </Button>
    </form>
  );
};

export const MarkSoldQuickAction = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <span className="flex items-center">
            <Tag className="mr-2 h-4 w-4" /> Tandai Terjual
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tandai Voucher Terjual</DialogTitle>
          <DialogDescription>
            Pilih platform, nominal, dan jumlah voucher yang terjual. Sistem akan otomatis mengambil voucher tertua (FIFO).
          </DialogDescription>
        </DialogHeader>
        <UpdateSoldVouchersForm onClose={() => setIsOpen(false)} onActionComplete={onActionComplete} />
      </DialogContent>
    </Dialog>
  );
};
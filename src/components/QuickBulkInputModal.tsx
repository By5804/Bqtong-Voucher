"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNominalDisplay } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle } from "lucide-react";

interface QuickBulkInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string;
  nominal: string;
  onSuccess: () => void;
}

const CHUNK_SIZE = 100;

export const QuickBulkInputModal = ({ isOpen, onClose, platform, nominal, onSuccess }: QuickBulkInputModalProps) => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [codes, setCodes] = useState("");
  const [source, setSource] = useState("");
  const [invoice, setInvoice] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const { toast } = useToast();

  const [duplicatesInInputList, setDuplicatesInInputList] = useState<string[]>([]);
  const [existingInDbList, setExistingInDbList] = useState<string[]>([]);

  // Clear states when modal opens/closes or target changes
  useEffect(() => {
    if (isOpen) {
      setCodes("");
      setSource("");
      setInvoice("");
      setDuplicatesInInputList([]);
      setExistingInDbList([]);
      setProgress({ processed: 0, total: 0 });
    }
  }, [isOpen, platform, nominal]);

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

    setLoading(true);
    setProgress({ processed: 0, total: 0 });
    setDuplicatesInInputList([]);
    setExistingInDbList([]);

    const codeList = codes.trim().split('\n').map(c => c.trim()).filter(c => c !== '');

    // 1. Check for duplicates within the input list
    const seenCodes = new Set<string>();
    const duplicatesInInput: string[] = [];
    codeList.forEach(code => {
      if (seenCodes.has(code)) {
        duplicatesInInput.push(code);
      } else {
        seenCodes.add(code);
      }
    });

    if (duplicatesInInput.length > 0) {
      const uniqueDuplicates = [...new Set(duplicatesInInput)];
      setDuplicatesInInputList(uniqueDuplicates);
      toast({
        title: "Duplikat Input",
        description: `Ada ${uniqueDuplicates.length} kode ganda di dalam teks yang Anda paste.`,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // 2. Check for codes that already exist in the database
    const uniqueCodes = Array.from(seenCodes);
    const { data: existingVouchers, error: checkError } = await supabase
      .from('vouchers')
      .select('code')
      .in('code', uniqueCodes);

    if (checkError) {
      toast({ title: "Error Pengecekan", description: `Gagal memeriksa database: ${checkError.message}`, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (existingVouchers && existingVouchers.length > 0) {
      const existingCodes = existingVouchers.map(v => v.code);
      setExistingInDbList(existingCodes);
      toast({
        title: "Kode Sudah Terdaftar",
        description: `${existingCodes.length} kode sudah pernah dimasukkan sebelumnya.`,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Insert vouchers
    setProgress({ processed: 0, total: uniqueCodes.length });
    let successfulInserts = 0;

    for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
      const chunk = uniqueCodes.slice(i, i + CHUNK_SIZE);
      
      const vouchersToInsert = chunk.map(code => ({
        tanggal,
        code,
        platform,
        nominal,
        source: source.trim() === '' ? null : source.trim(),
        invoice: invoice.trim() === '' ? null : invoice.trim(),
      }));

      const { error: insertError } = await supabase
        .from('vouchers')
        .insert(vouchersToInsert);

      if (insertError) {
        toast({ title: "Error Penyimpanan", description: `Gagal menyimpan batch ke-${i / CHUNK_SIZE + 1}: ${insertError.message}`, variant: "destructive" });
        setLoading(false);
        return;
      }
      
      successfulInserts += chunk.length;
      setProgress(prev => ({ ...prev, processed: prev.processed + chunk.length }));
    }

    toast({ title: "Sukses", description: `${successfulInserts} voucher berhasil ditambahkan ke ${platform} - ${formatNominalDisplay(nominal, platform)}.` });
    onSuccess();
    onClose();
    setLoading(false);
  };

  const progressValue = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left text-lg font-bold flex items-center gap-2">
            Input Voucher Massal
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Menambahkan stok untuk <strong className="text-indigo-600 dark:text-indigo-400">{platform}</strong> nominal <strong className="text-indigo-600 dark:text-indigo-400">{formatNominalDisplay(nominal, platform)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quick-tanggal" className="text-xs font-semibold">Tanggal</Label>
              <Input id="quick-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required disabled={loading} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-source" className="text-xs font-semibold">Source (Opsional)</Label>
              <Input id="quick-source" placeholder="Contoh: Paygift, Tokopedia" value={source} onChange={(e) => setSource(e.target.value)} disabled={loading} className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="quick-invoice" className="text-xs font-semibold">Nomor Invoice (Opsional)</Label>
            <Input id="quick-invoice" placeholder="Contoh: INV-20240801-001" value={invoice} onChange={(e) => setInvoice(e.target.value)} disabled={loading} className="h-9 text-xs" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label htmlFor="quick-codes" className="text-xs font-semibold">Kode Voucher (1 baris 1 kode)</Label>
              <span className="text-[11px] text-muted-foreground font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{voucherCount} baris</span>
            </div>
            <Textarea 
              id="quick-codes" 
              placeholder="CODE123&#10;CODE456&#10;CODE789" 
              value={codes} 
              onChange={(e) => setCodes(e.target.value)} 
              required 
              rows={8} 
              disabled={loading} 
              className="font-mono text-xs p-3 leading-relaxed"
            />
          </div>

          {/* Duplicates Alerts inside modal */}
          {(duplicatesInInputList.length > 0 || existingInDbList.length > 0) && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-red-800 dark:text-red-400 font-bold text-xs">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span>Terdeteksi Duplikat!</span>
              </div>
              
              {duplicatesInInputList.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-red-700">Ganda di Input ({duplicatesInInputList.length}):</div>
                  <ScrollArea className="h-20 border border-red-100 bg-white dark:bg-slate-900 rounded-lg p-2 font-mono text-[10px]">
                    {duplicatesInInputList.map((code, idx) => <div key={idx} className="text-red-600">{code}</div>)}
                  </ScrollArea>
                </div>
              )}

              {existingInDbList.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-red-700">Sudah Ada di DB ({existingInDbList.length}):</div>
                  <ScrollArea className="h-20 border border-red-100 bg-white dark:bg-slate-900 rounded-lg p-2 font-mono text-[10px]">
                    {existingInDbList.map((code, idx) => <div key={idx} className="text-red-600">{code}</div>)}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium text-slate-500">
                <span>Sedang menyimpan ke database...</span>
                <span>{progress.processed}/{progress.total}</span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>Batal</Button>
            <Button type="submit" size="sm" disabled={loading || voucherCount === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? "Menyimpan..." : `Simpan ${voucherCount} Voucher`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
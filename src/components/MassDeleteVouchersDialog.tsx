"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Eraser, Loader2 } from "lucide-react";
import { subMonths, subYears, format, startOfDay, endOfDay } from "date-fns";

export const MassDeleteVouchersDialog = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  
  const [deleteMode, setDeleteMode] = useState<'date' | 'age'>('age');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAge, setSelectedAge] = useState('6-months');
  const { toast } = useToast();

  // Fungsi untuk menghitung berapa voucher yang akan dihapus
  const fetchTargetCount = useCallback(async () => {
    setCounting(true);
    try {
      let query = supabase.from('vouchers').select('*', { count: 'exact', head: true });

      if (deleteMode === 'date') {
        query = query.eq('tanggal', selectedDate);
      } else {
        let cutoffDate = new Date();
        if (selectedAge === '1-month') cutoffDate = subMonths(new Date(), 1);
        else if (selectedAge === '6-months') cutoffDate = subMonths(new Date(), 6);
        else if (selectedAge === '1-year') cutoffDate = subYears(new Date(), 1);
        query = query.lt('created_at', cutoffDate.toISOString());
      }

      const { count, error } = await query;
      if (error) throw error;
      setTargetCount(count || 0);
    } catch (error: any) {
      console.error("Error counting vouchers:", error);
      setTargetCount(0);
    } finally {
      setCounting(false);
    }
  }, [deleteMode, selectedDate, selectedAge]);

  // Hitung ulang setiap kali kriteria berubah
  useEffect(() => {
    if (isOpen) {
      fetchTargetCount();
    }
  }, [isOpen, fetchTargetCount]);

  const handleMassDelete = async () => {
    if (targetCount === 0) return;
    
    setLoading(true);
    setProgress(0);
    
    try {
      // Kita ambil ID voucher yang akan dihapus untuk diproses dalam batch
      // Supaya kita bisa menampilkan progress bar yang akurat
      let fetchQuery = supabase.from('vouchers').select('id');

      if (deleteMode === 'date') {
        fetchQuery = fetchQuery.eq('tanggal', selectedDate);
      } else {
        let cutoffDate = new Date();
        if (selectedAge === '1-month') cutoffDate = subMonths(new Date(), 1);
        else if (selectedAge === '6-months') cutoffDate = subMonths(new Date(), 6);
        else if (selectedAge === '1-year') cutoffDate = subYears(new Date(), 1);
        fetchQuery = fetchQuery.lt('created_at', cutoffDate.toISOString());
      }

      const { data: vouchersToDelete, error: fetchError } = await fetchQuery;
      if (fetchError) throw fetchError;

      if (!vouchersToDelete || vouchersToDelete.length === 0) {
        setLoading(false);
        return;
      }

      const allIds = vouchersToDelete.map(v => v.id);
      const total = allIds.length;
      const CHUNK_SIZE = 200; // Hapus 200 voucher per batch
      let deleted = 0;

      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + CHUNK_SIZE);
        const { error: deleteError } = await supabase
          .from('vouchers')
          .delete()
          .in('id', chunk);

        if (deleteError) throw deleteError;
        
        deleted += chunk.length;
        setProgress(Math.round((deleted / total) * 100));
      }

      toast({ 
        title: "Sukses", 
        description: `${deleted} voucher berhasil dihapus selamanya.`,
      });
      
      onActionComplete();
      setIsOpen(false);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: `Gagal menghapus: ${error.message}`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Eraser className="mr-2 h-4 w-4" /> Pembersihan Massal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" /> Pembersihan Massal
          </DialogTitle>
          <DialogDescription>
            Hapus banyak voucher sekaligus. Tindakan ini **PERMANEN** dan tidak bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Metode Penghapusan</Label>
            <Select value={deleteMode} onValueChange={(v: any) => setDeleteMode(v)} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="age">Berdasarkan Usia Stok (FIFO)</SelectItem>
                <SelectItem value="date">Berdasarkan Tanggal Input</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {deleteMode === 'date' ? (
            <div className="space-y-2">
              <Label htmlFor="target-date">Pilih Tanggal Input:</Label>
              <Input 
                id="target-date" 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                disabled={loading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="target-age">Hapus Yang Lebih Tua Dari:</Label>
              <Select value={selectedAge} onValueChange={setSelectedAge} disabled={loading}>
                <SelectTrigger id="target-age">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-month">1 Bulan</SelectItem>
                  <SelectItem value="6-months">6 Bulan</SelectItem>
                  <SelectItem value="1-year">1 Tahun</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="p-3 bg-red-50 rounded-lg border border-red-100 mt-2">
            <p className="text-sm font-semibold text-red-700 flex items-center justify-between">
              Target Penghapusan:
              {counting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="text-lg">{targetCount?.toLocaleString() || 0} Voucher</span>
              )}
            </p>
          </div>

          {loading && (
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Memproses penghapusan...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>Batal</Button>
          <Button 
            variant="destructive" 
            onClick={handleMassDelete} 
            disabled={loading || counting || targetCount === 0}
          >
            {loading ? "Sedang Menghapus..." : `Ya, Hapus ${targetCount || 0} Voucher`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
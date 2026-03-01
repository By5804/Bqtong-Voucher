"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, AlertTriangle, Eraser } from "lucide-react";
import { subMonths, subYears, format } from "date-fns";

export const MassDeleteVouchersDialog = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'date' | 'age'>('age');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAge, setSelectedAge] = useState('6-months');
  const { toast } = useToast();

  const handleMassDelete = async () => {
    setLoading(true);
    try {
      let query = supabase.from('vouchers').delete();

      if (deleteMode === 'date') {
        // Hapus berdasarkan tanggal input spesifik
        query = query.eq('tanggal', selectedDate);
      } else {
        // Hapus berdasarkan usia (created_at)
        let cutoffDate = new Date();
        if (selectedAge === '1-month') cutoffDate = subMonths(new Date(), 1);
        else if (selectedAge === '6-months') cutoffDate = subMonths(new Date(), 6);
        else if (selectedAge === '1-year') cutoffDate = subYears(new Date(), 1);
        
        query = query.lt('created_at', cutoffDate.toISOString());
      }

      const { error } = await query;

      if (error) throw error;

      toast({ 
        title: "Sukses", 
        description: `Pembersihan massal berhasil dilakukan.`,
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
            Hapus banyak voucher sekaligus berdasarkan kriteria tertentu. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Metode Penghapusan</Label>
            <Select value={deleteMode} onValueChange={(v: any) => setDeleteMode(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="age">Berdasarkan Usia Stok (Lama)</SelectItem>
                <SelectItem value="date">Berdasarkan Tanggal Spesifik</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {deleteMode === 'date' ? (
            <div className="space-y-2">
              <Label htmlFor="target-date">Hapus Voucher Tanggal:</Label>
              <Input 
                id="target-date" 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="target-age">Hapus Voucher Yang Lebih Tua Dari:</Label>
              <Select value={selectedAge} onValueChange={setSelectedAge}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleMassDelete} disabled={loading}>
            {loading ? "Menghapus..." : "Ya, Hapus Massal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
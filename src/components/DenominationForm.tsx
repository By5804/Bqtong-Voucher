"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useDenominations } from "@/contexts/DenominationContext";
import { Database } from "@/integrations/supabase/types";

type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'];

export const DenominationForm = ({ onClose }: { onClose: () => void }) => {
  const [platformName, setPlatformName] = useState<string>('');
  const [denominationsInput, setDenominationsInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<PlatformDenomination | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<string | null>(null);

  const { toast } = useToast();
  const { platforms: platformDenominations, loading: loadingDenominations, refreshDenominations } = useDenominations();

  const resetForm = () => {
    setPlatformName('');
    setDenominationsInput('');
    setEditingPlatform(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPlatformName = platformName.trim();
    if (!trimmedPlatformName) {
      toast({ title: "Error", description: "Nama Platform tidak boleh kosong.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const newDenoms = denominationsInput.split(',').map(d => d.trim()).filter(d => d !== '');
    const isRenamingPlatform = editingPlatform && editingPlatform.platform_name !== trimmedPlatformName;

    if (isRenamingPlatform) {
      const { error: renameError } = await supabase.rpc('rename_platform', {
        old_name: editingPlatform.platform_name,
        new_name: trimmedPlatformName,
      });

      if (renameError) {
        toast({ title: "Error", description: `Gagal mengganti nama platform: ${renameError.message}`, variant: "destructive" });
        setLoading(false);
        return;
      }

      const { error: updateDenomError } = await supabase
        .from('platform_denominations')
        .update({ denominations: newDenoms })
        .eq('platform_name', trimmedPlatformName);
      
      if (updateDenomError) {
        toast({ title: "Peringatan", description: `Nama platform berhasil diganti, tapi gagal memperbarui daftar nominal: ${updateDenomError.message}`, variant: "destructive" });
      } else {
        toast({ title: "Sukses", description: "Data platform berhasil diperbarui." });
      }
      
    } else if (editingPlatform) {
      // Logic to detect denomination rename
      const oldDenoms = editingPlatform.denominations;
      const removed = oldDenoms.filter(d => !newDenoms.includes(d));
      const added = newDenoms.filter(d => !oldDenoms.includes(d));

      if (removed.length === 1 && added.length === 1) {
        // This is a denomination rename
        const { error: renameDenomError } = await supabase.rpc('rename_denomination', {
          p_platform_name: trimmedPlatformName,
          old_denom_name: removed[0],
          new_denom_name: added[0],
        });

        if (renameDenomError) {
          toast({ title: "Error", description: `Gagal mengganti nama nominal: ${renameDenomError.message}`, variant: "destructive" });
        } else {
          toast({ title: "Sukses", description: `Nominal "${removed[0]}" berhasil diubah menjadi "${added[0]}".` });
        }
      } else {
        // This is a simple list update (add/remove/reorder)
        const { error: updateError } = await supabase
          .from('platform_denominations')
          .update({ denominations: newDenoms })
          .eq('platform_name', trimmedPlatformName);
        
        if (updateError) {
          toast({ title: "Error", description: `Gagal memperbarui daftar nominal: ${updateError.message}`, variant: "destructive" });
        } else {
          toast({ title: "Sukses", description: "Daftar nominal berhasil diperbarui." });
        }
      }
    } else {
      // This is a new platform creation
      const { error } = await supabase
        .from('platform_denominations')
        .insert({ platform_name: trimmedPlatformName, denominations: newDenoms });

      if (error) {
        toast({ title: "Error", description: `Gagal menyimpan platform baru: ${error.message}`, variant: "destructive" });
      } else {
        toast({ title: "Sukses", description: "Platform baru berhasil ditambahkan." });
      }
    }

    resetForm();
    refreshDenominations();
    setLoading(false);
  };

  const handleEdit = (platform: PlatformDenomination) => {
    setEditingPlatform(platform);
    setPlatformName(platform.platform_name);
    setDenominationsInput(platform.denominations.join(', '));
  };

  const confirmDelete = (name: string) => {
    setPlatformToDelete(name);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!platformToDelete) return;

    setLoading(true);
    const { error } = await supabase
      .from('platform_denominations')
      .delete()
      .eq('platform_name', platformToDelete);

    if (error) {
      toast({ title: "Error", description: `Gagal menghapus: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: "Data berhasil dihapus." });
      refreshDenominations();
    }
    setLoading(false);
    setIsDeleteDialogOpen(false);
    setPlatformToDelete(null);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="platform-name-input">Nama Platform</Label>
          <Input 
            id="platform-name-input" 
            type="text" 
            value={platformName} 
            onChange={e => setPlatformName(e.target.value)} 
            required 
            disabled={loading} 
            placeholder="Contoh: Itemku, LG"
          />
        </div>
        <div>
          <Label htmlFor="denominations-input">Nominal (pisahkan dengan koma)</Label>
          <Input 
            id="denominations-input" 
            type="text" 
            value={denominationsInput} 
            onChange={e => setDenominationsInput(e.target.value)} 
            disabled={loading} 
            placeholder="Contoh: 50000, 100000, Random Steam Key"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Menyimpan..." : editingPlatform ? "Perbarui Data" : "Tambah Data"}
          </Button>
          {editingPlatform && (
            <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Batal Edit
            </Button>
          )}
        </div>
      </form>

      <h3 className="text-lg font-semibold mt-8">Daftar Platform & Nominal</h3>
      {loadingDenominations && platformDenominations.length === 0 ? (
        <p>Memuat daftar...</p>
      ) : platformDenominations.length === 0 ? (
        <p className="text-muted-foreground">Belum ada data yang tersimpan.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Platform</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platformDenominations.map((platform) => (
                <TableRow key={platform.platform_name}>
                  <TableCell>{platform.platform_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {platform.denominations.map((denom, index) => (
                        <Badge key={index} variant="secondary">{denom}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right flex gap-2 justify-end">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(platform)} disabled={loading}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => confirmDelete(platform.platform_name)} disabled={loading}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus data platform dan nominal terkait secara permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
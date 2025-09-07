"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, PlusCircle, ArrowLeft, Save } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useDenominations } from "@/contexts/DenominationContext";
import { Database } from "@/integrations/supabase/types";

type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'];

export const DenominationForm = ({ onClose }: { onClose: () => void }) => {
  const { toast } = useToast();
  const { platforms, loading: loadingDenominations, refreshDenominations } = useDenominations();

  const [view, setView] = useState<'platforms' | 'denominations'>('platforms');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformDenomination | null>(null);
  const [loading, setLoading] = useState(false);

  // State for platform add/edit modal
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [platformToEdit, setPlatformToEdit] = useState<PlatformDenomination | null>(null);
  const [platformNameInput, setPlatformNameInput] = useState('');

  // State for denomination add/edit
  const [newDenomName, setNewDenomName] = useState('');
  const [denomToEdit, setDenomToEdit] = useState<{ oldName: string; newName: string } | null>(null);

  const handleSavePlatform = async () => {
    const trimmedName = platformNameInput.trim();
    if (!trimmedName) {
      toast({ title: "Error", description: "Nama platform tidak boleh kosong.", variant: "destructive" });
      return;
    }
    setLoading(true);

    if (platformToEdit) { // Editing existing platform
      if (platformToEdit.platform_name !== trimmedName) {
        const { error } = await supabase.rpc('rename_platform', { old_name: platformToEdit.platform_name, new_name: trimmedName });
        if (error) {
          toast({ title: "Error", description: `Gagal mengganti nama: ${error.message}`, variant: "destructive" });
        } else {
          toast({ title: "Sukses", description: "Nama platform berhasil diperbarui." });
        }
      }
    } else { // Adding new platform
      const { error } = await supabase.from('platform_denominations').insert({ platform_name: trimmedName, denominations: [] });
      if (error) {
        toast({ title: "Error", description: `Gagal menambah platform: ${error.message}`, variant: "destructive" });
      } else {
        toast({ title: "Sukses", description: "Platform baru berhasil ditambahkan." });
      }
    }
    setLoading(false);
    setIsPlatformModalOpen(false);
    refreshDenominations();
  };

  const handleDeletePlatform = async (platformName: string) => {
    setLoading(true);
    const { error } = await supabase.from('platform_denominations').delete().eq('platform_name', platformName);
    if (error) {
      toast({ title: "Error", description: `Gagal menghapus platform: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: "Platform berhasil dihapus." });
    }
    setLoading(false);
    refreshDenominations();
  };

  const handleAddDenom = async () => {
    if (!selectedPlatform || !newDenomName.trim()) {
      toast({ title: "Error", description: "Nama nominal tidak boleh kosong.", variant: "destructive" });
      return;
    }
    const updatedDenoms = [...selectedPlatform.denominations, newDenomName.trim()];
    setLoading(true);
    const { data, error } = await supabase.from('platform_denominations').update({ denominations: updatedDenoms }).eq('platform_name', selectedPlatform.platform_name).select().single();
    if (error) {
      toast({ title: "Error", description: `Gagal menambah nominal: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: "Nominal baru berhasil ditambahkan." });
      setSelectedPlatform(data);
      setNewDenomName('');
    }
    setLoading(false);
    refreshDenominations();
  };

  const handleSaveDenomEdit = async () => {
    if (!selectedPlatform || !denomToEdit) return;
    setLoading(true);
    const { error } = await supabase.rpc('rename_denomination', { p_platform_name: selectedPlatform.platform_name, old_denom_name: denomToEdit.oldName, new_denom_name: denomToEdit.newName });
    if (error) {
      toast({ title: "Error", description: `Gagal mengganti nama nominal: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: "Nama nominal berhasil diperbarui." });
      const updatedPlatform = { ...selectedPlatform, denominations: selectedPlatform.denominations.map(d => d === denomToEdit.oldName ? denomToEdit.newName : d) };
      setSelectedPlatform(updatedPlatform);
      setDenomToEdit(null);
    }
    setLoading(false);
    refreshDenominations();
  };

  const handleDeleteDenom = async (denomName: string) => {
    if (!selectedPlatform) return;
    const updatedDenoms = selectedPlatform.denominations.filter(d => d !== denomName);
    setLoading(true);
    const { data, error } = await supabase.from('platform_denominations').update({ denominations: updatedDenoms }).eq('platform_name', selectedPlatform.platform_name).select().single();
    if (error) {
      toast({ title: "Error", description: `Gagal menghapus nominal: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: "Nominal berhasil dihapus." });
      setSelectedPlatform(data);
    }
    setLoading(false);
    refreshDenominations();
  };

  if (view === 'denominations' && selectedPlatform) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setView('platforms')}><ArrowLeft className="h-4 w-4" /></Button>
          <h3 className="text-lg font-semibold">Kelola Nominal untuk "{selectedPlatform.platform_name}"</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-denom-input">Tambah Nominal Baru</Label>
          <div className="flex gap-2">
            <Input id="new-denom-input" value={newDenomName} onChange={e => setNewDenomName(e.target.value)} placeholder="Contoh: 50k IDR" disabled={loading} />
            <Button onClick={handleAddDenom} disabled={loading || !newDenomName.trim()}><PlusCircle className="h-4 w-4 mr-2" /> Tambah</Button>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader><TableRow><TableHead>Nama Nominal</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {selectedPlatform.denominations.map(denom => (
                <TableRow key={denom}>
                  <TableCell>
                    {denomToEdit?.oldName === denom ? (
                      <Input value={denomToEdit.newName} onChange={e => setDenomToEdit({ ...denomToEdit, newName: e.target.value })} className="h-8" />
                    ) : (
                      denom
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {denomToEdit?.oldName === denom ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={handleSaveDenomEdit} disabled={loading}><Save className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setDenomToEdit(null)}>Batal</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setDenomToEdit({ oldName: denom, newName: denom })} disabled={loading}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={loading}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Hapus Nominal?</AlertDialogTitle><AlertDialogDescription>Ini akan menghapus nominal "{denom}" dari platform "{selectedPlatform.platform_name}".</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDenom(denom)}>Hapus</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Kelola Platform</h3>
        <Dialog open={isPlatformModalOpen} onOpenChange={setIsPlatformModalOpen}>
          <DialogTrigger asChild><Button onClick={() => handleOpenPlatformModal(null)}><PlusCircle className="h-4 w-4 mr-2" /> Tambah Platform</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{platformToEdit ? 'Ganti Nama Platform' : 'Tambah Platform Baru'}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="platform-name-input">Nama Platform</Label>
              <Input id="platform-name-input" value={platformNameInput} onChange={e => setPlatformNameInput(e.target.value)} />
            </div>
            <Button onClick={handleSavePlatform} disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Nama Platform</TableHead><TableHead>Jumlah Nominal</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {loadingDenominations ? (
              <TableRow><TableCell colSpan={3} className="text-center">Memuat...</TableCell></TableRow>
            ) : (
              platforms.map(p => (
                <TableRow key={p.platform_name}>
                  <TableCell className="font-medium">{p.platform_name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.denominations.length}</Badge></TableCell>
                  <TableCell className="text-right flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => handleSwitchToDenomView(p)}>Kelola Nominal</Button>
                    <Button variant="outline" size="icon" onClick={() => handleOpenPlatformModal(p)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Hapus Platform?</AlertDialogTitle><AlertDialogDescription>Ini akan menghapus platform "{p.platform_name}" dan semua nominalnya. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePlatform(p.platform_name)}>Hapus</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
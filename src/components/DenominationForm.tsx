"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, PlusCircle, ArrowLeft, Save, ArrowUp, ArrowDown, PauseCircle, PlayCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useDenominations } from "@/contexts/DenominationContext";
import { Database } from "@/integrations/supabase/types";
import { parseNominalInput, cn } from "@/lib/utils";

type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'];

export const DenominationForm = ({ onClose }: { onClose: () => void }) => {
  const { toast } = useToast();
  const { platforms, loading: loadingDenominations, refreshDenominations, movePlatformInOrder } = useDenominations();

  const [view, setView] = useState<'platforms' | 'denominations'>('platforms');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformDenomination | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [platformToEdit, setPlatformToEdit] = useState<PlatformDenomination | null>(null);
  const [platformNameInput, setPlatformNameInput] = useState('');
  const [newDenomName, setNewDenomName] = useState('');
  const [denomToEdit, setDenomToEdit] = useState<{ oldName: string; newName: string } | null>(null);

  const handleOpenPlatformModal = (platform: PlatformDenomination | null) => {
    setPlatformToEdit(platform);
    setPlatformNameInput(platform ? platform.platform_name : '');
    setIsPlatformModalOpen(true);
  };

  const handleSwitchToDenomView = (platform: PlatformDenomination) => {
    setSelectedPlatform(platform);
    setView('denominations');
  };

  const handleSavePlatform = async () => {
    const trimmedName = platformNameInput.trim();
    if (!trimmedName) return;
    setLoading(true);

    if (platformToEdit) {
      const { error } = await supabase.rpc('rename_platform', { old_name: platformToEdit.platform_name, new_name: trimmedName });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const maxSortOrder = platforms.reduce((max, p) => Math.max(max, p.sort_order || 0), 0);
      const { error } = await supabase.from('platform_denominations').insert({ 
        platform_name: trimmedName, 
        denominations: [], 
        on_hold_denominations: [],
        sort_order: maxSortOrder + 1 
      });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setLoading(false);
    setIsPlatformModalOpen(false);
    refreshDenominations();
  };

  const handleToggleHold = async (denomName: string) => {
    if (!selectedPlatform) return;
    const currentOnHold = selectedPlatform.on_hold_denominations || [];
    const isHold = currentOnHold.includes(denomName);
    const updatedOnHold = isHold ? currentOnHold.filter(d => d !== denomName) : [...currentOnHold, denomName];

    setLoading(true);
    const { data, error } = await supabase
      .from('platform_denominations')
      .update({ on_hold_denominations: updatedOnHold })
      .eq('platform_name', selectedPlatform.platform_name)
      .select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `Status ${denomName} diperbarui.` });
      setSelectedPlatform(data);
      refreshDenominations();
    }
    setLoading(false);
  };

  const handleAddDenom = async () => {
    if (!selectedPlatform || !newDenomName.trim()) return;
    const parsed = parseNominalInput(newDenomName);
    const updated = [...selectedPlatform.denominations, parsed];
    
    setLoading(true);
    const { data, error } = await supabase.from('platform_denominations').update({ denominations: updated }).eq('platform_name', selectedPlatform.platform_name).select().single();
    if (!error) {
      setSelectedPlatform(data);
      setNewDenomName('');
      refreshDenominations();
    }
    setLoading(false);
  };

  const handleDeleteDenom = async (denomName: string) => {
    if (!selectedPlatform) return;
    const updatedDenoms = selectedPlatform.denominations.filter(d => d !== denomName);
    const updatedHold = (selectedPlatform.on_hold_denominations || []).filter(d => d !== denomName);

    setLoading(true);
    const { data, error } = await supabase.from('platform_denominations').update({ 
      denominations: updatedDenoms, 
      on_hold_denominations: updatedHold 
    }).eq('platform_name', selectedPlatform.platform_name).select().single();
    if (!error) {
      setSelectedPlatform(data);
      refreshDenominations();
    }
    setLoading(false);
  };

  if (view === 'denominations' && selectedPlatform) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setView('platforms')}><ArrowLeft className="h-4 w-4" /></Button>
          <h3 className="text-lg font-semibold">Kelola Nominal: {selectedPlatform.platform_name}</h3>
        </div>
        <div className="flex gap-2">
          <Input value={newDenomName} onChange={e => setNewDenomName(e.target.value)} placeholder="Nominal Baru..." />
          <Button onClick={handleAddDenom} disabled={loading}><PlusCircle className="h-4 w-4 mr-2" /> Tambah</Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Nominal</TableHead>
                <TableHead className="w-[80px] text-center">Status</TableHead>
                <TableHead className="w-[120px]">Urutan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedPlatform.denominations.map((denom, index) => {
                const isHold = (selectedPlatform.on_hold_denominations || []).includes(denom);
                return (
                  <TableRow key={denom} className={cn(isHold && "bg-orange-50/50")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {denom}
                        {isHold && <Badge variant="outline" className="text-orange-600 border-orange-200">Hold</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => handleToggleHold(denom)} disabled={loading}>
                        {isHold ? <PlayCircle className="h-5 w-5 text-orange-600" /> : <PauseCircle className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={index === 0}><ArrowUp className="h-3 w-3" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={index === selectedPlatform.denominations.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDenom(denom)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Daftar Platform</h3>
        <Button onClick={() => handleOpenPlatformModal(null)}><PlusCircle className="h-4 w-4 mr-2" /> Tambah Platform</Button>
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Platform</TableHead>
              <TableHead>Stok Eksternal</TableHead>
              <TableHead>Dashboard</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {platforms.map(p => (
              <TableRow key={p.platform_name}>
                <TableCell className="font-medium">
                  {p.platform_name}
                  {(p.on_hold_denominations?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="ml-2 text-orange-600 border-orange-200">{p.on_hold_denominations?.length} Hold</Badge>
                  )}
                </TableCell>
                <TableCell><Switch checked={!!p.is_external_stock_enabled} /></TableCell>
                <TableCell><Switch checked={p.is_visible_on_dashboard} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleSwitchToDenomView(p)}>Kelola Nominal</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isPlatformModalOpen} onOpenChange={setIsPlatformModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Platform</DialogTitle></DialogHeader>
          <Input value={platformNameInput} onChange={e => setPlatformNameInput(e.target.value)} placeholder="Nama Platform..." />
          <Button onClick={handleSavePlatform} disabled={loading}>Simpan</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDenominations } from "@/contexts/DenominationContext";
import { formatNominalDisplay, parseNominalInput } from "@/lib/utils";

type ProductMapping = Database['public']['Tables']['product_mappings']['Row'];

export const ProductMappingForm = ({ onClose }: { onClose: () => void }) => {
  const [platform, setPlatform] = useState<string>('');
  const [nominal, setNominal] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');
  const [itemTypeId, setItemTypeId] = useState<string>('');
  const [itemInfoGroupId, setItemInfoGroupId] = useState<string>('');
  const [itemInfoId, setItemInfoId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [editingMapping, setEditingMapping] = useState<ProductMapping | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<string | null>(null);

  const { toast } = useToast();
  const { platforms, getDenominationsForPlatform, loading: loadingDenominations } = useDenominations();

  const platformOptions = useMemo(() => platforms.map(p => p.platform_name), [platforms]);
  const filteredNominalOptions = useMemo(() => {
    if (!platform) return [];
    return getDenominationsForPlatform(platform);
  }, [platform, getDenominationsForPlatform]);

  const sortAndSetMappings = (mappingsToSort: ProductMapping[]) => {
    const sorted = [...mappingsToSort].sort((a, b) => {
      const aIsUnconfigured = !a.product_id || a.product_id.trim() === '';
      const bIsUnconfigured = !b.product_id || b.product_id.trim() === '';

      if (aIsUnconfigured && !bIsUnconfigured) return -1;
      if (!aIsUnconfigured && bIsUnconfigured) return 1;

      const platformCompare = a.platform.localeCompare(b.platform);
      if (platformCompare !== 0) return platformCompare;

      const numA = parseInt(parseNominalInput(a.nominal), 10);
      const numB = parseInt(parseNominalInput(b.nominal), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return parseNominalInput(a.nominal).localeCompare(parseNominalInput(b.nominal));
    });
    setMappings(sorted);
  };

  const syncAndFetchMappings = useCallback(async () => {
    if (loadingDenominations) return;
    setLoading(true);

    const allDenominations = platforms.flatMap(p =>
      p.denominations.map(d => ({ platform: p.platform_name, nominal: parseNominalInput(d) })) // Parse nominal here
    );

    const { data: existingMappings, error: fetchError } = await supabase
      .from('product_mappings')
      .select('*');

    if (fetchError) {
      toast({ title: "Error", description: `Gagal memuat mapping: ${fetchError.message}`, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Use parsed nominal for comparison keys
    const existingMappingKeys = new Set(existingMappings.map(m => `${m.platform}-${parseNominalInput(m.nominal)}`));
    const mappingsToCreate = allDenominations.filter(d => !existingMappingKeys.has(`${d.platform}-${d.nominal}`));

    if (mappingsToCreate.length > 0) {
      const newMappingsPayload = mappingsToCreate.map(m => ({
        platform: m.platform,
        nominal: m.nominal, // This 'm.nominal' is already parsed
        game_id: 0,
        item_type_id: 0,
        item_info_group_id: 0,
        item_info_id: 0,
        product_id: '',
        store_name: null,
      }));

      const { error: insertError } = await supabase.from('product_mappings').insert(newMappingsPayload);

      if (insertError) {
        toast({ title: "Error", description: `Gagal membuat mapping baru: ${insertError.message}`, variant: "destructive" });
        sortAndSetMappings(existingMappings || []);
      } else {
        toast({ title: "Info", description: `${mappingsToCreate.length} mapping baru dibuat untuk denominasi yang belum ada. Harap lengkapi datanya.` });
        const { data: allMappings, error: refetchError } = await supabase.from('product_mappings').select('*');
        if (refetchError) {
          toast({ title: "Error", description: `Gagal memuat ulang mapping: ${refetchError.message}`, variant: "destructive" });
          sortAndSetMappings(existingMappings || []);
        } else {
          sortAndSetMappings(allMappings || []);
        }
      }
    } else {
      sortAndSetMappings(existingMappings || []);
    }

    setLoading(false);
  }, [platforms, loadingDenominations, toast]);

  useEffect(() => {
    if (!loadingDenominations) {
      syncAndFetchMappings();
    }
  }, [loadingDenominations, syncAndFetchMappings]);

  useEffect(() => {
    if (nominal && !filteredNominalOptions.includes(nominal)) {
      setNominal('');
    }
  }, [platform, nominal, filteredNominalOptions]);

  const resetForm = () => {
    setPlatform('');
    setNominal('');
    setGameId('');
    setItemTypeId('');
    setItemInfoGroupId('');
    setItemInfoId('');
    setProductId('');
    setStoreName('');
    setEditingMapping(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedGameId = parseInt(gameId, 10);
    const parsedItemTypeId = parseInt(itemTypeId, 10);
    const parsedItemInfoGroupId = parseInt(itemInfoGroupId, 10);
    const parsedItemInfoId = parseInt(itemInfoId, 10);
    const parsedNominalValue = parseNominalInput(nominal); // Parse nominal before submission

    if (
      !platform ||
      !parsedNominalValue.trim() ||
      isNaN(parsedGameId) ||
      isNaN(parsedItemTypeId) ||
      isNaN(parsedItemInfoGroupId) ||
      isNaN(parsedItemInfoId) ||
      !productId.trim()
    ) {
      toast({ title: "Error", description: "Harap isi semua field wajib dengan benar.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const payload = {
      platform,
      nominal: parsedNominalValue, // Use parsed nominal
      game_id: parsedGameId,
      item_type_id: parsedItemTypeId,
      item_info_group_id: parsedItemInfoGroupId,
      item_info_id: parsedItemInfoId,
      product_id: productId.trim(),
      store_name: storeName.trim() === '' ? null : storeName.trim(),
    };

    let error;
    if (editingMapping) {
      const { error: updateError } = await supabase
        .from('product_mappings')
        .update(payload)
        .eq('id', editingMapping.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('product_mappings')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      toast({ title: "Error", description: `Gagal menyimpan mapping: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: `Mapping berhasil ${editingMapping ? 'diperbarui' : 'ditambahkan'}.` });
      resetForm();
      syncAndFetchMappings();
    }
    setLoading(false);
  };

  const handleEdit = (mapping: ProductMapping) => {
    setEditingMapping(mapping);
    setPlatform(mapping.platform);
    setNominal(parseNominalInput(mapping.nominal)); // Display parsed nominal in the form for editing
    setGameId(String(mapping.game_id));
    setItemTypeId(String(mapping.item_type_id));
    setItemInfoGroupId(String(mapping.item_info_group_id));
    setItemInfoId(String(mapping.item_info_id));
    setProductId(mapping.product_id);
    setStoreName(mapping.store_name || '');
  };

  const confirmDelete = (id: string) => {
    setMappingToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!mappingToDelete) return;

    setLoading(true);
    const { error } = await supabase
      .from('product_mappings')
      .delete()
      .eq('id', mappingToDelete);

    if (error) {
      toast({ title: "Error", description: `Gagal menghapus mapping: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: "Mapping berhasil dihapus." });
      syncAndFetchMappings();
    }
    setLoading(false);
    setIsDeleteDialogOpen(false);
    setMappingToDelete(null);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="platform-select">Platform</Label>
          <Select value={platform} onValueChange={setPlatform} disabled={loading || !!editingMapping || loadingDenominations}>
            <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
            <SelectContent>
              {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="nominal-select">Nominal</Label>
          <Select value={nominal} onValueChange={setNominal} disabled={loading || !platform || !!editingMapping || loadingDenominations}>
            <SelectTrigger id="nominal-select"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
            <SelectContent>
              {filteredNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n, platform)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="game-id-input">Game ID</Label>
          <Input id="game-id-input" type="number" value={gameId} onChange={e => setGameId(e.target.value)} required disabled={loading} />
        </div>
        <div>
          <Label htmlFor="item-type-id-input">Item Type ID</Label>
          <Input id="item-type-id-input" type="number" value={itemTypeId} onChange={e => setItemTypeId(e.target.value)} required disabled={loading} />
        </div>
        <div>
          <Label htmlFor="item-info-group-id-input">Item Info Group ID</Label>
          <Input id="item-info-group-id-input" type="number" value={itemInfoGroupId} onChange={e => setItemInfoGroupId(e.target.value)} required disabled={loading} />
        </div>
        <div>
          <Label htmlFor="item-info-id-input">Item Info ID</Label>
          <Input id="item-info-id-input" type="number" value={itemInfoId} onChange={e => setItemInfoId(e.target.value)} required disabled={loading} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="product-id-input">Product ID</Label>
          <Input id="product-id-input" type="text" value={productId} onChange={e => setProductId(e.target.value)} disabled={loading} placeholder="ID Produk Eksternal" required />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="store-name-input">Nama Toko (Itemku) <span className="text-muted-foreground">(Opsional)</span></Label>
          <Input id="store-name-input" type="text" value={storeName} onChange={e => setStoreName(e.target.value)} disabled={loading} placeholder="Nama Toko di Itemku" />
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Menyimpan..." : editingMapping ? "Perbarui Mapping" : "Tambah Mapping"}
          </Button>
          {editingMapping && (
            <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Batal Edit
            </Button>
          )}
        </div>
      </form>

      <h3 className="text-lg font-semibold mt-8">Daftar Mapping Tersimpan</h3>
      {loading && mappings.length === 0 ? (
        <p>Memuat dan menyinkronkan daftar mapping...</p>
      ) : mappings.length === 0 ? (
        <p className="text-muted-foreground">Belum ada mapping yang tersimpan.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Game ID</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead>Nama Toko</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id} className={!mapping.product_id ? "bg-yellow-50" : ""}>
                  <TableCell>{mapping.platform}</TableCell>
                  <TableCell>{formatNominalDisplay(mapping.nominal, mapping.platform)}</TableCell>
                  <TableCell>{mapping.game_id}</TableCell>
                  <TableCell>{mapping.product_id || <span className="text-red-500">Belum diisi</span>}</TableCell>
                  <TableCell>{mapping.store_name || '-'}</TableCell>
                  <TableCell className="text-right flex gap-2 justify-end">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(mapping)} disabled={loading}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => confirmDelete(mapping.id)} disabled={loading}>
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
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Ini akan menghapus mapping secara permanen.</AlertDialogDescription>
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
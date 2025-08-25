"use client";

import { useState, useEffect, useMemo } from "react";
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

type ProductMapping = Database['public']['Tables']['product_mappings']['Row'];
type Platform = "LG" | "wahyu" | "Itemku";
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku"];
const ALL_NOMINAL_OPTIONS_STR = ["100", "200", "50000", "65000", "100000", "200000", "300000", "500000"];

const formatNominalDisplay = (nominal: string | number) => {
  const numNominal = typeof nominal === 'string' ? parseInt(nominal, 10) : nominal;
  if (numNominal === 100) return "100 RBX";
  if (numNominal === 200) return "200 RBX";
  return numNominal.toLocaleString('id-ID') + 'K';
};

const getFilteredNominalOptions = (platform: Platform | '') => {
  if (platform === "Itemku") {
    return ALL_NOMINAL_OPTIONS_STR;
  } else if (platform === "LG" || platform === "wahyu") {
    return ALL_NOMINAL_OPTIONS_STR.filter(n => parseInt(n, 10) >= 50000);
  }
  return [];
};

export const ProductMappingForm = ({ onClose }: { onClose: () => void }) => {
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [nominal, setNominal] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');
  const [itemTypeId, setItemTypeId] = useState<string>('');
  const [itemInfoGroupId, setItemInfoGroupId] = useState<string>('');
  const [itemInfoId, setItemInfoId] = useState<string>('');
  const [productId, setProductId] = useState<string>(''); // Default ke string kosong
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [editingMapping, setEditingMapping] = useState<ProductMapping | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<string | null>(null);

  const { toast } = useToast();

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(platform), [platform]);

  useEffect(() => {
    if (nominal && !filteredNominalOptions.includes(nominal)) {
      setNominal(filteredNominalOptions.length > 0 ? filteredNominalOptions[0] : '');
    } else if (!nominal && filteredNominalOptions.length > 0) {
      setNominal(filteredNominalOptions[0]);
    }
  }, [platform, nominal, filteredNominalOptions]);

  const fetchMappings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_mappings')
      .select('*')
      .order('platform', { ascending: true })
      .order('nominal', { ascending: true });

    if (error) {
      toast({ title: "Error", description: `Gagal memuat mapping: ${error.message}`, variant: "destructive" });
    } else {
      setMappings(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const resetForm = () => {
    setPlatform('');
    setNominal('');
    setGameId('');
    setItemTypeId('');
    setItemInfoGroupId('');
    setItemInfoId('');
    setProductId(''); // Reset ke string kosong
    setEditingMapping(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedNominal = parseInt(nominal, 10);
    const parsedGameId = parseInt(gameId, 10);
    const parsedItemTypeId = parseInt(itemTypeId, 10);
    const parsedItemInfoGroupId = parseInt(itemInfoGroupId, 10);
    const parsedItemInfoId = parseInt(itemInfoId, 10);

    if (
      !platform ||
      isNaN(parsedNominal) ||
      isNaN(parsedGameId) ||
      isNaN(parsedItemTypeId) ||
      isNaN(parsedItemInfoGroupId) ||
      isNaN(parsedItemInfoId) ||
      !productId.trim() // Validasi product_id tidak boleh kosong
    ) {
      toast({ title: "Error", description: "Harap isi semua field wajib dengan benar.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const payload = {
      platform,
      nominal: parsedNominal,
      game_id: parsedGameId,
      item_type_id: parsedItemTypeId,
      item_info_group_id: parsedItemInfoGroupId,
      item_info_id: parsedItemInfoId,
      product_id: productId.trim(), // Pastikan product_id tidak kosong
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
      fetchMappings();
    }
    setLoading(false);
  };

  const handleEdit = (mapping: ProductMapping) => {
    setEditingMapping(mapping);
    setPlatform(mapping.platform as Platform);
    setNominal(String(mapping.nominal));
    setGameId(String(mapping.game_id));
    setItemTypeId(String(mapping.item_type_id));
    setItemInfoGroupId(String(mapping.item_info_group_id));
    setItemInfoId(String(mapping.item_info_id));
    setProductId(mapping.product_id); // Set product_id dari mapping
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
      fetchMappings();
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
          <Select value={platform} onValueChange={(value: Platform) => setPlatform(value)} disabled={loading || !!editingMapping}>
            <SelectTrigger id="platform-select"><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
            <SelectContent>
              {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="nominal-select">Nominal</Label>
          <Select value={nominal} onValueChange={setNominal} disabled={loading || !platform || !!editingMapping}>
            <SelectTrigger id="nominal-select"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
            <SelectContent>
              {filteredNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>)}
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
        <p>Memuat daftar mapping...</p>
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
                <TableHead>Item Type ID</TableHead>
                <TableHead>Item Info Group ID</TableHead>
                <TableHead>Item Info ID</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>{mapping.platform}</TableCell>
                  <TableCell>{formatNominalDisplay(mapping.nominal)}</TableCell>
                  <TableCell>{mapping.game_id}</TableCell>
                  <TableCell>{mapping.item_type_id}</TableCell>
                  <TableCell>{mapping.item_info_group_id}</TableCell>
                  <TableCell>{mapping.item_info_id}</TableCell>
                  <TableCell>{mapping.product_id}</TableCell> {/* product_id tidak lagi null */}
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
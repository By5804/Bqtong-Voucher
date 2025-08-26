"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Platform = Database['public']['Tables']['vouchers']['Row']['platform'];
const platformOptions: Platform[] = ["LG", "wahyu", "Itemku", "Itemku Steam Game Key"];

const formatNominalDisplay = (nominal: string) => {
  const strNominal = String(nominal);
  if (strNominal === "100") return "100 RBX";
  if (strNominal === "200") return "200 RBX";
  if (strNominal === "400") return "400 RBX";
  if (strNominal.includes("Random Steam Key")) return strNominal;

  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return numNominal.toLocaleString('id-ID') + 'K';
  }
  return strNominal;
};

const getFilteredNominalOptions = (platform: Platform | '') => {
  if (platform === "Itemku") {
    return ["50000", "65000", "100000", "200000", "300000", "500000"];
  } else if (platform === "LG" || platform === "wahyu") {
    return ["50000", "65000", "200000"];
  } else if (platform === "Itemku Steam Game Key") {
    return ["Random Steam Key", "Random Epical Steam Key", "Random Legendary Steam Key", "Random Mythical Steam Key", "Random Premium Steam Key"];
  }
  return [];
};

export const UpdateSoldVouchers = () => {
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [nominal, setNominal] = useState<string | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const filteredNominalOptions = useMemo(() => getFilteredNominalOptions(platform), [platform]);

  useEffect(() => {
    // Reset nominal if the selected platform changes and the current nominal is no longer valid
    if (nominal && !filteredNominalOptions.includes(nominal)) {
      setNominal(filteredNominalOptions.length > 0 ? filteredNominalOptions[0] : '');
    } else if (!nominal && filteredNominalOptions.length > 0) {
      // Set a default if no nominal is selected and options are available
      setNominal(filteredNominalOptions[0]);
    }
  }, [platform, nominal, filteredNominalOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform || !nominal || quantity <= 0) {
      toast({ title: "Error", description: "Harap isi semua field dengan benar.", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke('mark-vouchers-sold', {
      body: { platform, nominal: nominal, quantity },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal mengupdate: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: data.message });
      // Reset form
      setPlatform('');
      setNominal('');
      setQuantity(1);
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-4xl mt-8">
      <CardHeader>
        <CardTitle>Update Voucher Terjual</CardTitle>
        <CardDescription>Tandai voucher sebagai terjual. Sistem akan otomatis mengambil voucher tertua (FIFO).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Platform</label>
            <Select value={platform} onValueChange={(v: Platform) => setPlatform(v)} required>
              <SelectTrigger><SelectValue placeholder="Pilih Platform" /></SelectTrigger>
              <SelectContent>
                {platformOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nominal</label>
            <Select value={nominal} onValueChange={setNominal} required disabled={!platform}>
              <SelectTrigger><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
              <SelectContent>
                {filteredNominalOptions.map(n => <SelectItem key={n} value={n}>{formatNominalDisplay(n)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah</label>
            <Input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} min="1" required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Memproses..." : "Update Terjual"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
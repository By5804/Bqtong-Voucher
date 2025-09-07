"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ArrowDown } from "lucide-react";
import { Label } from "@/components/ui/label";

type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'];

export const MoveDenominationForm = ({ onClose }: { onClose: () => void; }) => {
  const [loading, setLoading] = useState(false);
  const [allPlatforms, setAllPlatforms] = useState<PlatformDenomination[]>([]);
  const [sourcePlatform, setSourcePlatform] = useState<string>('');
  const [targetPlatform, setTargetPlatform] = useState<string>('');
  const [denominationToMove, setDenominationToMove] = useState<string>('');
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlatforms = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('platform_denominations').select('*');
      if (error) {
        toast({ title: "Error", description: "Gagal memuat data platform.", variant: "destructive" });
      } else {
        setAllPlatforms(data || []);
      }
      setLoading(false);
    };
    fetchPlatforms();
  }, [toast]);

  const sourceDenominations = useMemo(() => {
    return allPlatforms.find(p => p.platform_name === sourcePlatform)?.denominations || [];
  }, [sourcePlatform, allPlatforms]);

  const targetPlatformOptions = useMemo(() => {
    return allPlatforms.filter(p => p.platform_name !== sourcePlatform);
  }, [sourcePlatform, allPlatforms]);

  useEffect(() => {
    setDenominationToMove('');
  }, [sourcePlatform]);

  useEffect(() => {
    if (sourcePlatform && !targetPlatformOptions.some(p => p.platform_name === targetPlatform)) {
      setTargetPlatform('');
    }
  }, [sourcePlatform, targetPlatform, targetPlatformOptions]);

  const handleMove = async () => {
    if (!sourcePlatform || !targetPlatform || !denominationToMove) {
      toast({ title: "Error", description: "Harap isi semua field.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('move-denomination', {
      body: {
        sourcePlatform,
        targetPlatform,
        denomination: denominationToMove,
      },
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memindahkan: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Sukses", description: data.message });
      onClose();
    }
    setLoading(false);
  };

  const isMoveDisabled = loading || !sourcePlatform || !targetPlatform || !denominationToMove;

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg space-y-3">
        <h4 className="font-semibold text-sm">Sumber</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="source-platform">Platform</Label>
            <Select value={sourcePlatform} onValueChange={setSourcePlatform} required>
              <SelectTrigger id="source-platform"><SelectValue placeholder="Pilih Platform Sumber" /></SelectTrigger>
              <SelectContent>
                {allPlatforms.map(p => <SelectItem key={p.platform_name} value={p.platform_name}>{p.platform_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="source-denomination">Nominal</Label>
            <Select value={denominationToMove} onValueChange={setDenominationToMove} required disabled={!sourcePlatform}>
              <SelectTrigger id="source-denomination"><SelectValue placeholder="Pilih Nominal" /></SelectTrigger>
              <SelectContent>
                {sourceDenominations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <ArrowDown className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="p-4 border rounded-lg space-y-3">
        <h4 className="font-semibold text-sm">Tujuan</h4>
        <div>
          <Label htmlFor="target-platform">Platform</Label>
          <Select value={targetPlatform} onValueChange={setTargetPlatform} required disabled={!sourcePlatform}>
            <SelectTrigger id="target-platform"><SelectValue placeholder="Pilih Platform Tujuan" /></SelectTrigger>
            <SelectContent>
              {targetPlatformOptions.map(p => <SelectItem key={p.platform_name} value={p.platform_name}>{p.platform_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleMove} disabled={isMoveDisabled} className="w-full">
        {loading ? "Memproses..." : "Pindahkan Nominal"}
      </Button>
    </div>
  );
};
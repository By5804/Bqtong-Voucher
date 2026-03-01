"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/components/ui/use-toast';

type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'];

interface DenominationContextType {
  platforms: PlatformDenomination[];
  loading: boolean;
  getDenominationsForPlatform: (platformName: string) => string[];
  getOnHoldDenominationsForPlatform: (platformName: string) => string[];
  refreshDenominations: () => void;
  movePlatformInOrder: (platformName: string, direction: 'up' | 'down') => Promise<void>;
}

const DenominationContext = createContext<DenominationContextType | undefined>(undefined);

export const DenominationProvider = ({ children }: { children: ReactNode }) => {
  const [platforms, setPlatforms] = useState<PlatformDenomination[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDenominations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_denominations')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error("Error fetching platform denominations:", error);
      setPlatforms([]);
      toast({ title: "Error", description: `Gagal memuat platform: ${error.message}`, variant: "destructive" });
    } else {
      setPlatforms(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchDenominations();
  }, [fetchDenominations]);

  const getDenominationsForPlatform = (platformName: string): string[] => {
    const platform = platforms.find(p => p.platform_name === platformName);
    return platform ? platform.denominations : [];
  };

  const getOnHoldDenominationsForPlatform = (platformName: string): string[] => {
    const platform = platforms.find(p => p.platform_name === platformName);
    return platform?.on_hold_denominations || [];
  };

  const movePlatformInOrder = useCallback(async (platformName: string, direction: 'up' | 'down') => {
    setLoading(true);
    const currentIndex = platforms.findIndex(p => p.platform_name === platformName);
    if (currentIndex === -1) {
      setLoading(false);
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= platforms.length) {
      setLoading(false);
      return;
    }

    const platformA = platforms[currentIndex];
    const platformB = platforms[targetIndex];

    const { error } = await supabase.rpc('swap_platform_order', {
      platform_name_a: platformA.platform_name,
      platform_name_b: platformB.platform_name,
    });

    if (error) {
      toast({ title: "Error", description: `Gagal memindahkan platform: ${error.message}`, variant: "destructive" });
    } else {
      await fetchDenominations();
    }
    setLoading(false);
  }, [platforms, fetchDenominations, toast]);

  const value = {
    platforms,
    loading,
    getDenominationsForPlatform,
    getOnHoldDenominationsForPlatform,
    refreshDenominations: fetchDenominations,
    movePlatformInOrder,
  };

  return (
    <DenominationContext.Provider value={value}>
      {children}
    </DenominationContext.Provider>
  );
};

export const useDenominations = () => {
  const context = useContext(DenominationContext);
  if (context === undefined) {
    throw new Error('useDenominations must be used within a DenominationProvider');
  }
  return context;
};
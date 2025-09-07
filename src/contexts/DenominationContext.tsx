"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'];

interface DenominationContextType {
  platforms: PlatformDenomination[];
  loading: boolean;
  getDenominationsForPlatform: (platformName: string) => string[];
  refreshDenominations: () => void;
}

const DenominationContext = createContext<DenominationContextType | undefined>(undefined);

export const DenominationProvider = ({ children }: { children: ReactNode }) => {
  const [platforms, setPlatforms] = useState<PlatformDenomination[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDenominations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_denominations')
      .select('*')
      .order('platform_name', { ascending: true });

    if (error) {
      console.error("Error fetching platform denominations:", error);
      setPlatforms([]);
    } else {
      setPlatforms(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDenominations();
  }, [fetchDenominations]);

  const getDenominationsForPlatform = (platformName: string): string[] => {
    const platform = platforms.find(p => p.platform_name === platformName);
    return platform ? platform.denominations : [];
  };

  const value = {
    platforms,
    loading,
    getDenominationsForPlatform,
    refreshDenominations: fetchDenominations,
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
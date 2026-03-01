"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Define the type with the new on_hold_denominations field
export type PlatformDenomination = Database['public']['Tables']['platform_denominations']['Row'] & {
  on_hold_denominations?: string[];
};

interface DenominationContextType {
  platforms: PlatformDenomination[];
  loading: boolean;
  refreshDenominations: () => Promise<void>;
  getDenominationsForPlatform: (platformName: string) => string[];
  movePlatformInOrder: (platformName: string, direction: 'up' | 'down') => Promise<void>;
}

const DenominationContext = createContext<DenominationContextType | undefined>(undefined);

export const DenominationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [platforms, setPlatforms] = useState<PlatformDenomination[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDenominations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_denominations')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error("Error fetching denominations:", error);
    } else {
      setPlatforms((data as PlatformDenomination[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDenominations();
  }, [fetchDenominations]);

  const getDenominationsForPlatform = useCallback((platformName: string) => {
    const platform = platforms.find(p => p.platform_name === platformName);
    return platform ? platform.denominations : [];
  }, [platforms]);

  const movePlatformInOrder = async (platformName: string, direction: 'up' | 'down') => {
    const currentIndex = platforms.findIndex(p => p.platform_name === platformName);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= platforms.length) return;

    const newPlatforms = [...platforms];
    const currentPlatform = { ...newPlatforms[currentIndex] };
    const targetPlatform = { ...newPlatforms[targetIndex] };

    // Swap sort orders
    const tempOrder = currentPlatform.sort_order;
    currentPlatform.sort_order = targetPlatform.sort_order;
    targetPlatform.sort_order = tempOrder;

    // Update local state immediately for UI responsiveness
    newPlatforms[currentIndex] = targetPlatform;
    newPlatforms[targetIndex] = currentPlatform;
    setPlatforms(newPlatforms);

    // Update database
    const { error: error1 } = await supabase
      .from('platform_denominations')
      .update({ sort_order: currentPlatform.sort_order })
      .eq('platform_name', currentPlatform.platform_name);

    const { error: error2 } = await supabase
      .from('platform_denominations')
      .update({ sort_order: targetPlatform.sort_order })
      .eq('platform_name', targetPlatform.platform_name);

    if (error1 || error2) {
      console.error("Error updating sort order:", error1 || error2);
      fetchDenominations(); // Revert on error
    }
  };

  return (
    <DenominationContext.Provider value={{ 
      platforms, 
      loading, 
      refreshDenominations: fetchDenominations,
      getDenominationsForPlatform,
      movePlatformInOrder
    }}>
      {children}
    </DenominationContext.Provider>
  );
};

export const useDenominations = () => {
  const context = useContext(DenominationContext);
  if (context === undefined) {
    throw new Error("useDenominations must be used within a DenominationProvider");
  }
  return context;
};

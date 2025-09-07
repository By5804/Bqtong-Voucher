"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SyncDenominationStockForm } from "@/components/SyncDenominationStockForm";
import { RefreshCcw } from "lucide-react"; // Menggunakan ikon yang berbeda untuk membedakan

export const SyncDenominationStockQuickAction = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <span className="flex items-center">
            <RefreshCcw className="mr-2 h-4 w-4" /> Samakan Stok Denom
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Samakan Stok per Denominasi</DialogTitle>
          <DialogDescription>
            Sesuaikan stok internal agar sama dengan stok eksternal untuk denominasi tertentu.
          </DialogDescription>
        </DialogHeader>
        <SyncDenominationStockForm onClose={() => setIsOpen(false)} onActionComplete={onActionComplete} />
      </DialogContent>
    </Dialog>
  );
};
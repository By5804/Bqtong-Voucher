"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SyncPlatformStockForm } from "@/components/SyncPlatformStockForm";
import { Tags, RefreshCw } from "lucide-react";

export const SyncPlatformStockQuickAction = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <span className="flex items-center">
            <RefreshCw className="mr-2 h-4 w-4" /> Samakan Stok Kategori
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Samakan Stok per Kategori</DialogTitle>
          <DialogDescription>
            Sesuaikan stok internal agar sama dengan stok eksternal dengan menandai voucher yang berlebih sebagai terjual.
          </DialogDescription>
        </DialogHeader>
        <SyncPlatformStockForm onClose={() => setIsOpen(false)} onActionComplete={onActionComplete} />
      </DialogContent>
    </Dialog>
  );
};
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MarkPlatformSoldForm } from "@/components/MarkPlatformSoldForm";
import { Tags } from "lucide-react";

export const MarkPlatformSoldQuickAction = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <span className="flex items-center">
            <Tags className="mr-2 h-4 w-4" /> Tandai Terjual per Kategori
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tandai Terjual per Kategori</DialogTitle>
          <DialogDescription>
            Pilih platform untuk menandai semua voucher yang tersedia di dalamnya sebagai terjual.
          </DialogDescription>
        </DialogHeader>
        <MarkPlatformSoldForm onClose={() => setIsOpen(false)} onActionComplete={onActionComplete} />
      </DialogContent>
    </Dialog>
  );
};
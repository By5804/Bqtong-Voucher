"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MoveVouchersForm } from "@/components/MoveVouchersForm";
import { ArrowRightLeft } from "lucide-react";

export const MoveVouchersQuickAction = ({ onActionComplete }: { onActionComplete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <span className="flex items-center">
            <ArrowRightLeft className="mr-2 h-4 w-4" /> Pindahkan Voucher
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Pindahkan Voucher</DialogTitle>
          <DialogDescription>
            Pindahkan voucher dari satu kategori/denom ke kategori/denom lain. Sistem akan memindahkan voucher tertua (FIFO).
          </DialogDescription>
        </DialogHeader>
        <MoveVouchersForm onClose={() => setIsOpen(false)} onActionComplete={onActionComplete} />
      </DialogContent>
    </Dialog>
  );
};
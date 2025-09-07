"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MoveDenominationForm } from "@/components/MoveDenominationForm";
import { Shuffle } from "lucide-react";

export const MoveDenominationQuickAction = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <span className="flex items-center">
            <Shuffle className="mr-2 h-4 w-4" /> Pindahkan Denom
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Pindahkan Nominal Antar Platform</DialogTitle>
          <DialogDescription>
            Pindahkan definisi sebuah nominal dari satu platform ke platform lainnya.
          </DialogDescription>
        </DialogHeader>
        <MoveDenominationForm onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};
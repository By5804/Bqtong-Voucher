"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DenominationForm } from "@/components/DenominationForm";
import { ListPlus } from "lucide-react";

export const ManageDenominationsQuickAction = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <span className="flex items-center">
            <ListPlus className="mr-2 h-4 w-4" /> Kelola Denom & Kategori
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Denominasi & Kategori Platform</DialogTitle>
          <DialogDescription>
            Tambahkan, edit, atau hapus daftar nominal untuk setiap platform.
          </DialogDescription>
        </DialogHeader>
        <DenominationForm onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};
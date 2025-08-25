"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductMappingForm } from "@/components/ProductMappingForm";
import { Settings } from "lucide-react";

export const ManageProductMappingsQuickAction = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <span className="flex items-center">
            <Settings className="mr-2 h-4 w-4" /> Kelola Mapping Produk
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Mapping Produk Itemku</DialogTitle>
          <DialogDescription>
            Tambahkan, edit, atau hapus ID produk Itemku untuk setiap kombinasi platform dan nominal.
          </DialogDescription>
        </DialogHeader>
        <ProductMappingForm onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};
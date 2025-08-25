"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SoldOutDisplay } from "@/components/SoldOutDisplay";
import { BarChart } from "lucide-react";

export const ViewSoldVouchersQuickAction = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <span className="flex items-center">
            <BarChart className="mr-2 h-4 w-4" /> Data Terjual
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Data Voucher Terjual</DialogTitle>
          <DialogDescription>
            Ringkasan jumlah voucher yang telah terjual berdasarkan platform dan nominal.
          </DialogDescription>
        </DialogHeader>
        <SoldOutDisplay />
      </DialogContent>
    </Dialog>
  );
};
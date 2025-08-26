"use client";

import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { StockDisplay } from "@/components/StockDisplay";
import { MarkSoldQuickAction } from "@/components/MarkSoldQuickAction";
import { ViewSoldVouchersQuickAction } from "@/components/ViewSoldVouchersQuickAction";
import { ManageProductMappingsQuickAction } from "@/components/ManageProductMappingsQuickAction"; // Import komponen baru
import { PlusCircle } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [stockKey, setStockKey] = useState(0);
  const refreshStockDisplay = () => setStockKey(prev => prev + 1);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Sistem Manajemen Voucher</h1>
        <p className="text-xl text-gray-600">
          Kelola data voucher redeem dengan mudah
        </p>
      </div>

      <StockDisplay key={stockKey} />
      
      <div className="text-center flex flex-col items-center gap-4 w-full max-w-4xl">
        <p className="text-lg mb-2">Aksi Cepat:</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild>
            <Link to="/vouchers">Lihat & Hapus Voucher</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/input-vouchers">Input Voucher Massal</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/move-vouchers">Pindahkan Voucher</Link>
          </Button>
          <MarkSoldQuickAction onActionComplete={refreshStockDisplay} />
          <ViewSoldVouchersQuickAction />
          <Button asChild variant="success" className="bg-green-600 hover:bg-green-700 text-white">
            <Link to="/manual-stock-adjustment">
              <span className="flex items-center">
                <PlusCircle className="mr-2 h-4 w-4" /> Tambah Stok Manual
              </span>
            </Link>
          </Button>
          <ManageProductMappingsQuickAction /> {/* Menambahkan tombol aksi cepat baru */}
        </div>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default Index;
"use client";

import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { StockDisplay } from "@/components/StockDisplay";
import { MarkSoldQuickAction } from "@/components/MarkSoldQuickAction";
import { PlusCircle, ListChecks } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Sistem Manajemen Voucher</h1>
        <p className="text-xl text-gray-600">
          Kelola data voucher redeem dengan mudah
        </p>
      </div>

      <StockDisplay />
      
      <div className="text-center flex flex-col items-center gap-4">
        <p className="text-lg mb-4">Aksi Cepat:</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
          <Button asChild>
            <Link to="/vouchers"><span>Lihat & Hapus Voucher</span></Link> {/* Dibungkus dengan span */}
          </Button>
          <Button asChild variant="outline">
            <Link to="/input-vouchers"><span>Input Voucher Massal</span></Link> {/* Dibungkus dengan span */}
          </Button>
          <Button asChild variant="secondary">
            <Link to="/move-vouchers"><span>Pindahkan Voucher</span></Link> {/* Dibungkus dengan span */}
          </Button>
          <MarkSoldQuickAction />
          <Button asChild variant="success" className="bg-green-600 hover:bg-green-700 text-white">
            <Link to="/manual-stock-adjustment">
              <span className="flex items-center">
                <PlusCircle className="mr-2 h-4 w-4" /> Tambah Stok Manual
              </span>
            </Link>
          </Button>
          <Button asChild variant="info" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link to="/sold-vouchers">
              <span className="flex items-center">
                <ListChecks className="mr-2 h-4 w-4" /> Data Voucher Terjual
              </span>
            </Link>
          </Button>
        </div>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default Index;
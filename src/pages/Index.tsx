"use client";

import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { StockDisplay } from "@/components/StockDisplay";
import { MarkSoldQuickAction } from "@/components/MarkSoldQuickAction";
import { PlusCircle } from "lucide-react";
import { SoldOutDisplay } from "@/components/SoldOutDisplay"; // Import komponen baru

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
      
      <div className="text-center flex flex-col items-center gap-4"> {/* Menambahkan flex-col dan items-center untuk tata letak vertikal */}
        <p className="text-lg mb-4">Aksi Cepat:</p>
        <SoldOutDisplay /> {/* Memindahkan komponen SoldOutDisplay di sini */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4"> {/* Menambahkan margin-top untuk pemisah visual */}
          <Button asChild>
            <Link to="/vouchers">Lihat & Hapus Voucher</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/input-vouchers">Input Voucher Massal</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/move-vouchers">Pindahkan Voucher</Link>
          </Button>
          <MarkSoldQuickAction />
          <Button asChild variant="success" className="bg-green-600 hover:bg-green-700 text-white">
            <Link to="/manual-stock-adjustment">
              <span className="flex items-center">
                <PlusCircle className="mr-2 h-4 w-4" /> Tambah Stok Manual
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
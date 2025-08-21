"use client";

import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import Link from "next/link";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Sistem Manajemen Voucher</h1>
        <p className="text-xl text-gray-600 mb-6">
          Kelola data voucher redeem dengan mudah
        </p>
        <Button asChild>
          <Link href="/vouchers">Mulai Kelola Voucher</Link>
        </Button>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;
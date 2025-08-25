import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VoucherPage from "./pages/vouchers";
import InputVouchersPage from "./pages/InputVouchers";
import MoveVouchersPage from "./pages/MoveVouchers";
import ManualStockAdjustmentPage from "./pages/ManualStockAdjustment";
import SoldVouchersPage from "./pages/SoldVouchersPage"; // Import halaman baru

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/vouchers" element={<VoucherPage />} />
          <Route path="/input-vouchers" element={<InputVouchersPage />} />
          <Route path="/move-vouchers" element={<MoveVouchersPage />} />
          <Route path="/manual-stock-adjustment" element={<ManualStockAdjustmentPage />} />
          <Route path="/sold-vouchers" element={<SoldVouchersPage />} /> {/* Rute baru */}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import React from "react"; // Import React secara eksplisit
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VoucherPage from "./pages/vouchers";
import InputVouchersPage from "./pages/InputVouchers";
import ManualStockAdjustmentPage from "./pages/ManualStockAdjustment";
import { DenominationProvider } from "./contexts/DenominationContext";

const queryClient = new QueryClient();

const App = () => (
  <React.Fragment> {/* Menggunakan React.Fragment eksplisit */}
    <Toaster />
    <Sonner />
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DenominationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/vouchers" element={<VoucherPage />} />
              <Route path="/input-vouchers" element={<InputVouchersPage />} />
              <Route path="/manual-stock-adjustment" element={<ManualStockAdjustmentPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DenominationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </React.Fragment>
);

export default App;
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVouchers } from "@/contexts/VoucherContext";
import { formatNominalDisplay, parseNominalInput } from "@/lib/utils";
import { useExternalStock } from "@/contexts/ExternalStockContext";

interface DenominationCardProps {
  platform: string;
  denomination: string;
  onClick: () => void;
}

export const DenominationCard = ({ platform, denomination, onClick }: DenominationCardProps) => {
  const { getVoucherCount } = useVouchers();
  const { getExternalStockCount } = useExternalStock();

  const parsedDenom = parseNominalInput(denomination);
  const internalStock = getVoucherCount(platform, parsedDenom);
  const externalStock = getExternalStockCount(platform, parsedDenom);

  const isOutOfExternalStock = externalStock === 0;

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all hover:shadow-md hover:border-primary ${isOutOfExternalStock ? 'border-red-500/50 hover:border-red-600' : ''}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-medium ${isOutOfExternalStock ? 'text-red-600' : ''}`}>
          {formatNominalDisplay(denomination, platform)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isOutOfExternalStock ? 'text-red-600' : ''}`}>
          INT: {internalStock}
        </div>
        <p className={`text-xs text-muted-foreground ${isOutOfExternalStock ? 'text-red-500' : ''}`}>
          EXT: {externalStock}
        </p>
      </CardContent>
    </Card>
  );
};
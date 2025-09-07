import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatNominalDisplay = (nominal: string | number, platform?: string) => {
  const strNominal = String(nominal);

  if (platform && platform.toLowerCase().includes('valorant')) {
    const numNominal = parseInt(strNominal, 10);
    if (!isNaN(numNominal)) {
      return `${numNominal.toLocaleString('id-ID')} VP`;
    }
  }

  if (["100", "200", "400", "500"].includes(strNominal)) {
    return `${strNominal} RBX`;
  }
  if (strNominal.includes("Random Steam Key")) {
    return strNominal;
  }
  const numNominal = parseInt(strNominal, 10);
  if (!isNaN(numNominal)) {
    return `${numNominal.toLocaleString('id-ID')} IDR`;
  }
  return strNominal;
};
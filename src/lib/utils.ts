import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatNominalDisplay = (nominal: string | number, platform?: string) => {
  const strNominal = String(nominal).trim();

  // If the string is not purely numeric, it's a custom name (e.g., "100 Robux", "Random Steam Key").
  // In this case, we should display it as is, without trying to format it.
  // A simple check is to convert it to a number and back to a string. If it's not the same, it's not a pure number.
  if (String(Number(strNominal)) !== strNominal) {
      return strNominal;
  }

  // From this point, we know strNominal is a purely numeric string that needs formatting.

  if (platform && platform.toLowerCase().includes('valorant')) {
    return `${Number(strNominal).toLocaleString('id-ID')} VP`;
  }

  // Legacy rule for specific Robux denominations
  if (["100", "200", "400", "500"].includes(strNominal)) {
    return `${strNominal} RBX`;
  }
  
  // For any other number, format as IDR by default.
  return `${Number(strNominal).toLocaleString('id-ID')} IDR`;
};
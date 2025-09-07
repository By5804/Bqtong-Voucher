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

export const parseNominalInput = (input: string): string => {
  const trimmedInput = input.trim();

  // Check for common suffixes and remove them, then strip non-numeric characters
  let parsed = trimmedInput
    .replace(/\s*IDR$/i, '') // Remove IDR suffix
    .replace(/\s*RBX$/i, '') // Remove RBX suffix
    .replace(/\s*VP$/i, '')  // Remove VP suffix
    .replace(/\./g, '');     // Remove thousands separators (dots)

  // If after stripping suffixes and dots, it's a valid number, return it as a number string
  if (!isNaN(Number(parsed)) && parsed !== '') {
    return String(Number(parsed)); // Ensure it's a clean number string
  }

  // If it's not a number (e.g., "Random Steam Key") or a number with other characters, return as is
  return trimmedInput;
};
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getShortChantierName = (address: string) => {
  if (!address) return '';
  // Try to match standard French format: zip code followed by city
  const match = address.match(/\b\d{5}\s+([A-Za-zÀ-ÖØ-öø-ÿ\-\s]+?)(?:,|$)/);
  if (match) {
    return match[1].trim();
  }
  
  // Fallback splitting by comma
  const parts = address.split(',').map(p => p.trim());
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.toLowerCase() === 'france' && parts.length > 1) {
      return parts[parts.length - 2].replace(/^\d{5}\s+/, '').trim();
    }
    return lastPart.replace(/^\d{5}\s+/, '').trim();
  }
  return address;
};

import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatBytes(bytes: number | bigint | null): string {
  if (bytes === null || bytes === undefined) return "Unknown";
  const size = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let displaySize = size;
  while (displaySize >= 1024 && unitIndex < units.length - 1) {
    displaySize /= 1024;
    unitIndex++;
  }
  return `${displaySize.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export function parseSize(value: string, unit: string): bigint {
  const val = parseFloat(value);
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  return BigInt(Math.floor(val * (multipliers[unit.toUpperCase()] || 1)));
}

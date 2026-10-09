/**
 * CSV Parsing Utilities for Bulk Link Creation
 */

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvLinks(csvText: string): Array<{
  destinationUrl: string;
  alias?: string;
  tag?: string;
  externalRef?: string;
  expiresAt?: string;
}> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const results = [];
  const firstParts = parseCsvLine(lines[0]);
  const firstCol = (firstParts[0] || '').toLowerCase();
  const isHeader = !firstCol.startsWith('http://') && !firstCol.startsWith('https://') && (firstCol.includes('destination') || firstCol === 'url' || firstCol === 'link');
  const startIdx = isHeader ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (!parts[0]) continue;
    results.push({
      destinationUrl: parts[0],
      alias: parts[1] || undefined,
      tag: parts[2] || undefined,
      externalRef: parts[3] || undefined,
      expiresAt: parts[4] || undefined,
    });
  }
  return results;
}

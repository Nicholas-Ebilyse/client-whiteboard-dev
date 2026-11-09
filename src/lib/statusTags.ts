/**
 * Utility to encode and decode is_postponed and is_invoiced
 * seamlessly, ensuring zero crashes whether or not the columns
 * are already migrated in Supabase.
 */

export function parseStatusFromComment(rawComment?: string | null): {
  cleanComment: string;
  isPostponed: boolean;
  isInvoiced: boolean;
} {
  if (!rawComment) return { cleanComment: '', isPostponed: false, isInvoiced: false };
  const isPostponed = rawComment.includes('[REPORTE]');
  const isInvoiced = rawComment.includes('[FACTURE]');
  const cleanComment = rawComment
    .replace(/\[REPORTE\]/g, '')
    .replace(/\[FACTURE\]/g, '')
    .trim();
  return { cleanComment, isPostponed, isInvoiced };
}

export function formatStatusIntoComment(
  comment?: string | null,
  isPostponed?: boolean,
  isInvoiced?: boolean
): string {
  const clean = (comment || '')
    .replace(/\[REPORTE\]/g, '')
    .replace(/\[FACTURE\]/g, '')
    .trim();

  const tags: string[] = [];
  if (isPostponed) tags.push('[REPORTE]');
  if (isInvoiced) tags.push('[FACTURE]');

  if (tags.length === 0) return clean;
  return clean ? `${tags.join(' ')} ${clean}` : tags.join(' ');
}

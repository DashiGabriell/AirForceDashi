/**
 * Public URL for a medal icon in apps/web/public/icons/medals.
 * Kept off `/medals` because the Vite dev proxy sends that path to the API.
 */
export function medalPublicPath(medalId: string): string {
  return `/icons/medals/${medalId}.png`;
}

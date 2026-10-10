/**
 * Public numbers shown in the landing page trust bar.
 *
 * Only put figures here that can be reproduced from the database. Update
 * them monthly and change `asOf` whenever you do, so the page never shows an
 * undated claim. Definitions:
 *  - registeredUsers: rows in User
 *  - activeUsers30d: distinct users with a SUCCESS transaction in the last 30 days
 *  - successfulTransactions: Transaction rows with status SUCCESS (shown as "N+")
 *  - activeApiPartners: partners with an active status (approved but inactive are not counted)
 */
export const LANDING_STATS = {
  asOf: '2026-10-10',
  registeredUsers: 364,
  activeUsers30d: 195,
  successfulTransactions: 1890,
  activeApiPartners: 11,
} as const;

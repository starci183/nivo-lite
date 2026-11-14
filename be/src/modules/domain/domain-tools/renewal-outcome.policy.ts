/**
 * WHETHER A RENEWAL TOOK EFFECT, proved by the provider's own data, never by its words: a renewal is `renewed` when the expiry the
 * provider states NOW differs from the one it stated before the renewal (the renewal moved it); otherwise it is `pending` (the order was
 * accepted, its reference kept, and the expiry has not moved yet, or a read could not state it). A pending renewal is checked again later
 * with `nivo.tool.domain.renewal.get`, by the same proof. The customer is told "renewed" only on `renewed` (owner ruling R57).
 */

/** The renewal took effect: the new end date is known. */
export const RENEWED = "renewed"

/** The order was accepted but its effect is not proved yet. */
export const PENDING = "pending"

/** What a renewal came to, as a node branches on it. */
export type RenewalOutcome = typeof RENEWED | typeof PENDING

/** `renewed` when both expiries are stated and the later one differs from the earlier; `pending` otherwise. */
export const renewalOutcomeOf = (before: string | null, after: string | null): RenewalOutcome =>
    before !== null && after !== null && after !== before ? RENEWED : PENDING

/** A service renewal whose answer states the new end date is `renewed`; one that states none is `pending`. */
export const serviceRenewalOutcomeOf = (expiresOn: string | null): RenewalOutcome => (expiresOn === null ? PENDING : RENEWED)

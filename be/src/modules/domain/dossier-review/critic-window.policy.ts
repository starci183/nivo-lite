import { windowsArgue, type ValueDates } from "@modules/domain/brain-facts"

/**
 * Whether two DIFFERENT values of one thing argue once their periods are read: date arithmetic only, owned by the truths store
 * (`brain-facts/fact-window.policy.ts` `windowsArgue`), so the store's own "disagrees with" and the critic's contradiction points
 * agree on what a contradiction is. A value stated for a period beside a standing value is that period's value, not a second
 * opinion; two periods that do not overlap are two periods.
 */

/** Whether a waiting value argues with another value of its key (`windowsArgue`). */
export const arguesInTime = (fact: ValueDates, other: ValueDates, otherInForce: boolean): boolean => windowsArgue(fact, other, otherInForce)

/** Whether two waiting values of one key, read from one document, argue: in either direction. */
export const argueInTime = (a: ValueDates, b: ValueDates): boolean => windowsArgue(a, b, false) || windowsArgue(b, a, false)

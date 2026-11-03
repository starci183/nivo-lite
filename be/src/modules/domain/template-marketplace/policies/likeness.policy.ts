import type { LikenessClaim } from "@nivo/agent-sdk/template"

/** The part of a consent record the check reads. */
export interface ConsentRecord {
    /** The person. */
    readonly personName: string
    /** What of them the agent may use. */
    readonly allowedUses: ReadonlyArray<string>
    /** When the consent ends, or null. */
    readonly expiresAt: Date | null
    /** When the person took it back, or null. */
    readonly revokedAt: Date | null
}

const same = (left: string, right: string): boolean => left.trim().toLowerCase() === right.trim().toLowerCase()

/**
 * True when a persona of a real person is covered: a consent of that same person, not taken back, not ended, that allows every use the
 * persona claims. A neutral persona (no claim) needs none.
 */
export const consentCovers = (claim: LikenessClaim | null, records: ReadonlyArray<ConsentRecord>, now: Date): boolean =>
    claim === null ||
    records.some(
        (record) =>
            same(record.personName, claim.personName) &&
            record.revokedAt === null &&
            (record.expiresAt === null || record.expiresAt.getTime() > now.getTime()) &&
            claim.allowedUses.every((use) => record.allowedUses.includes(use)),
    )

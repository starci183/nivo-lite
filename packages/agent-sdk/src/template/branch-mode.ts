import { isRecord } from "../schema/is-record"

/**
 * The member a branch held its mode under before it was named `mode`. A graph version stored then is immutable, so it still carries
 * it; nothing writes it any more.
 */
export const LEGACY_BRANCH_MODE_MEMBER = "then"

/** The member a branch holds its mode under. */
export const BRANCH_MODE_MEMBER = "mode"

/**
 * A stored branch as it is read today: the same members in the same order, the legacy member named `mode`. A value that is no object,
 * or a branch that already holds `mode`, is handed back untouched; so a branch carrying BOTH members keeps both, and the strict branch
 * schema that follows refuses it. Reading only: the stored document and its recorded hash are never rewritten.
 */
export const branchModeRead = (value: unknown): unknown => {
    if (!isRecord(value)) return value
    if (!Object.hasOwn(value, LEGACY_BRANCH_MODE_MEMBER) || Object.hasOwn(value, BRANCH_MODE_MEMBER)) return value
    return Object.fromEntries(
        Object.entries(value).map(([name, member]) => [
            name === LEGACY_BRANCH_MODE_MEMBER ? BRANCH_MODE_MEMBER : name,
            member,
        ]),
    )
}

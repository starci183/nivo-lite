import type { DataRight, RightGap, RightsGrant } from "./rights.types"

/** Why one grant right does not cover a required right, or null when it does. `workspace` covers `turn`; `write` does not imply `read`. */
const gapOf = (held: DataRight, required: DataRight): Pick<RightGap, "missing"> | null => {
    if (held.access !== required.access) return { missing: "access" }
    if (held.scope === "turn" && required.scope === "workspace") return { missing: "scope" }
    const missing = required.fields.filter((field) => !held.fields.includes(field))
    return missing.length === 0 ? null : { missing }
}

/** The gap of one required right against a grant, or null when covered. */
const gapAgainst = (grant: RightsGrant, required: DataRight): RightGap | null => {
    const ofKind = grant.rights.filter((held) => held.kind === required.kind)
    if (ofKind.length === 0) return { right: required, missing: "kind" }
    let missing: RightGap["missing"] = "kind"
    for (const [index, held] of ofKind.entries()) {
        const gap = gapOf(held, required)
        if (gap === null) return null
        if (index === 0) missing = gap.missing
    }
    return { right: required, missing }
}

/** The required rights a grant does not cover; empty = covered. */
export const rightsGaps = (grant: RightsGrant, required: ReadonlyArray<DataRight>): ReadonlyArray<RightGap> =>
    required.flatMap((right) => gapAgainst(grant, right) ?? [])

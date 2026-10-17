import { allGatesConfirmed, gateEntry, gatesOf, snapshotOf } from "@/modules/installations"
import type { ContextVersion, SetupSession } from "@/modules/installations"
import type { ModuleKey } from "@/modules/catalog"

/** How far the checklist is and whether applying the draft would change anything. */
type SetupProgress = {
    readonly confirmed: number
    readonly total: number
    /** Every gate is confirmed. */
    readonly isReady: boolean
    /** The draft is already the version in use. */
    readonly isUnchanged: boolean
}

/** The progress of the gate checklist of a module against the version in use. */
export const setupProgressOf = (
    moduleKey: ModuleKey,
    session: SetupSession,
    active: ContextVersion | null,
): SetupProgress => {
    const gates = gatesOf(moduleKey)
    return {
        confirmed: gates.filter((gate) => gateEntry(session.gateEvidence, gate.key).status === "confirmed").length,
        total: gates.length,
        isReady: allGatesConfirmed(moduleKey, session.gateEvidence),
        isUnchanged:
            active !== null &&
            JSON.stringify(active.snapshot) === JSON.stringify(snapshotOf(session.draft, session.gateEvidence)),
    }
}

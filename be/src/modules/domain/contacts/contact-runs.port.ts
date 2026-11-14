import type { EntityManager } from "typeorm"

/**
 * The boundary between a contact's deletion and the work engine's runs (coordinator rulings R37 / R43 on owner ruling R31): when a person
 * is deleted no event of them comes again (the same human writing again is a NEW contact on a NEW route), so the runs parked on them
 * would sit until their own expiry. The work engine implements this port (agent-threads); the contacts never read a run. Optional: with no
 * implementation bound (an app with no work engine), a deletion ends no run.
 */
export interface ContactRunsPort {
    /**
     * Ends, in the deletion's own database transaction and BEFORE the contacts are marked deleted, every run parked on the contacts (the
     * contact and every id merged into it) or on one of their routes; answers how many runs it ended.
     */
    erasing(tx: EntityManager, workspaceId: string, contactIds: ReadonlyArray<string>): Promise<number>
}

/** The injection token of the runs of a contact being deleted. */
export const CONTACT_RUNS: unique symbol = Symbol("CONTACT_RUNS")

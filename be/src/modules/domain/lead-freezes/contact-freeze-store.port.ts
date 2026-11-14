import type { EntityManager } from "typeorm"
import type { FreezeSubject, FreezeValues, FreezeStatus, LeadFreeze } from "./lead-freezes.contracts"

/** One read of a freeze by a column the store indexes. */
export type FreezeLookup =
    | { readonly key: string }
    | { readonly frozenRunId: string }
    | { readonly contactId: string }
    | { readonly id: string }

/**
 * The freezes of people (public.contact_freezes), each member scoped to the workspace it names. `manager` joins a caller's own
 * transaction (one that writes a work item with it); without it every member is one statement of its own.
 */
export interface ContactFreezeStore {
    /** The first freeze the lookup finds, or null. */
    find(workspaceId: string, lookup: FreezeLookup, manager?: EntityManager): Promise<LeadFreeze | null>
    /** The freezes in one status, oldest freeze first, at most `limit`. */
    inStatus(workspaceId: string, status: FreezeStatus, limit: number): Promise<ReadonlyArray<LeadFreeze>>
    /** Writes a new freeze of the subject with `values`; null when the subject's key holds one already (nothing written). */
    insert(workspaceId: string, subject: FreezeSubject, values: FreezeValues): Promise<LeadFreeze | null>
    /** Writes members of a freeze at the version read; null when another write moved it first or it is gone (nothing written). */
    update(workspaceId: string, id: string, expected: string, values: FreezeValues, manager?: EntityManager): Promise<LeadFreeze | null>
}

/** The injection token of the freeze store. */
export const CONTACT_FREEZE_STORE: unique symbol = Symbol("CONTACT_FREEZE_STORE")

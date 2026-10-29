import { fakeInbox } from "@starci/jest-preset"
import type { EntityInbox, InboxEntityReceipt } from "@modules/platform/inbox"

/** What `claimRow` received for one winning or refused claim. */
export interface RowClaim {
    /** The door. */
    readonly source: string
    /** The sender's delivery id. */
    readonly eventId: string
    /** The receipt entity and row the caller asked to insert. */
    readonly receipt: InboxEntityReceipt
}

/**
 * A `fakeInbox` that also implements `claimRow`: the claim wins once per `(source, eventId)` like the real unique key,
 * and `winning` false makes every claim lose, as a repeat delivery does.
 */
export const fakeRowInbox = (winning = true) => {
    const inbox = fakeInbox()
    const rowClaims: Array<RowClaim> = []
    const claimRow: EntityInbox["claimRow"] = (source, eventId, _manager, receipt) => {
        rowClaims.push({ source, eventId, receipt })
        if (!winning || eventId.trim() === "" || source === "") return Promise.resolve(false)
        return inbox.claim(source, eventId)
    }
    return Object.assign(inbox, { claimRow, rowClaims })
}

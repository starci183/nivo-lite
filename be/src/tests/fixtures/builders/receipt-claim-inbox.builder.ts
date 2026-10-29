import type { fakeInbox } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { Inbox, InboxReceipt } from "@modules/platform/inbox"

/** Makes the inbox double run the provider-owned receipt insert through the caller's manager, as the real inbox does. */
export const attachReceiptClaim = (inbox: ReturnType<typeof fakeInbox>): void => {
    const claim = inbox.claim.bind(inbox)
    const claimReceipt: Inbox["claim"] = async (
        source: string,
        eventId: string,
        manager?: EntityManager,
        receipt?: InboxReceipt,
    ) => {
        if (eventId === "" || manager === undefined || receipt === undefined) return false
        const rows = await manager.query<Array<{ readonly id: string }>>(receipt.insert, [
            source,
            eventId,
            JSON.stringify(receipt.payload),
        ])
        return rows.length > 0 && claim(source, eventId)
    }
    inbox.claim = claimReceipt
}

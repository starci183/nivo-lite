import type { Inbox } from "./inbox.port"

/**
 * Accepts every delivery. The domain row that stores the event id is what turns a repeat into one record and answers
 * that record's id, so this claim does not suppress the write. It has no dependencies, so the container builds it
 * without a decorator.
 */
export class InboxService implements Inbox {
    /** True when the caller should record the delivery. A blank source and a blank event id is not a delivery. */
    claim(source: string, eventId: string): Promise<boolean> {
        return Promise.resolve(source !== "" || eventId !== "")
    }
}

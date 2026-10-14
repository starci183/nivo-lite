/** The inbox port: a delivery method claims `(source, eventId)` before it acts, so a repeat can be told from a first delivery. */
export interface Inbox {
    /**
     * Claims one delivery. True when this pair is new; false when it was already claimed.
     * `source` names the door, `eventId` is the sender's id of the delivery.
     */
    claim(source: string, eventId: string): Promise<boolean>
}

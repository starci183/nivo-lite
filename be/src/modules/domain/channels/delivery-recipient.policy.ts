/** The delivery reason stored on a message that was kept in the conversation but could not be pushed, because the customer has no recipient on the channel yet. */
export const RECIPIENT_NOT_LINKED = "recipient_not_linked"

/** Whether the conversation has a recipient to push to: the website chat reads the page itself; any other channel needs the customer id and the connection. */
export const recipientLinked = (target: {
    readonly channel: string
    readonly externalId: string | null
    readonly connectionId: string | null
}): boolean => target.channel === "website" || (target.externalId !== null && target.connectionId !== null)

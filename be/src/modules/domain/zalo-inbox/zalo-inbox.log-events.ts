/** Log events of the Zalo inbox: ids, codes and field names only, never the words of a customer. */
export enum ZaloInboxLogEvent {
    /** A Zalo delivery was accepted but is no event the chat answers (a follow, a seen), so it is closed without an answer. */
    EventIgnored = "zalo_inbox.event_ignored",
}

/** Log events of the chat node ports: ids and codes only, never the words of a customer. */
export enum ChatNodePortsLogEvent {
    /** A message was stored in a conversation whose customer has no linked recipient on the channel, so nothing was pushed. */
    Undelivered = "chat_node_ports.undelivered",
    /** A customer send was pushed: the turn, the stored message and the channel's verdict, never the words. */
    Sent = "chat_node_ports.sent",
    /** A customer send was refused by a rule or by the channel: the turn and the reason, never the words. */
    Refused = "chat_node_ports.refused",
    /** A customer send hit a channel that is not taking messages for now, so the step is tried again: the turn and the reason. */
    SendFailed = "chat_node_ports.send_failed",
}

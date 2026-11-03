/** Log events of the chat node ports: ids and codes only, never the words of a customer. */
export enum ChatNodePortsLogEvent {
    /** A message was stored in a conversation whose customer has no linked recipient on the channel, so nothing was pushed. */
    Undelivered = "chat_node_ports.undelivered",
}

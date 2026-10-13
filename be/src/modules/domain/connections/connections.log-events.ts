/** Log events of the connections capability. */
export enum ConnectionsLogEvent {
    /** A sealed secret could not be opened with the current channel key; the connection reads as having none. */
    SecretUnreadable = "connections.secret_unreadable",
}

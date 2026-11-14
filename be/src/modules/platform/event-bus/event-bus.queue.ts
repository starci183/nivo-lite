// The topics and consumer queues of the event bus: each queue is a literal constant, never composed at runtime (R336). The names are
// declared by the event-bus migration, which creates `<topic>__<consumer>` and `<topic>__<consumer>__dead` and binds the queue to its
// topic (R258); a topic is the event name a publisher sends to. A new consumer adds a constant here and a migration, nothing else.

/** The event name and pgmq topic of `event_bus_probe`. */
export const EVENT_BUS_PROBE_TOPIC = "event_bus_probe"

/** The event name and pgmq topic of `decision_made`. */
export const DECISION_MADE_TOPIC = "decision_made"

/** The event name and pgmq topic of `approval_resolved`. */
export const APPROVAL_RESOLVED_TOPIC = "approval_resolved"

/** The queue of the `agent_graphs` consumer of `approval_resolved`. */
export const APPROVAL_RESOLVED_AGENT_GRAPHS_TOPIC_QUEUE = "approval_resolved__agent_graphs"

/** The event name and pgmq topic of `installation_changed`. */
export const INSTALLATION_CHANGED_TOPIC = "installation_changed"

/** The queue of the `agent_sync` consumer of `installation_changed`. */
export const INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE = "installation_changed__agent_sync"

/** The event name and pgmq topic of `knowledge_source_indexed`. */
export const KNOWLEDGE_SOURCE_INDEXED_TOPIC = "knowledge_source_indexed"

/** The queue of the `brain` consumer of `knowledge_source_indexed`. */
export const KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE = "knowledge_source_indexed__brain"

/** The queue of the `agent_wakes` consumer of `knowledge_source_indexed`. */
export const KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE = "knowledge_source_indexed__agent_wakes"

/** The queue of the `agent_wakes` consumer of `installation_changed`. */
export const INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE = "installation_changed__agent_wakes"

/** The event name and pgmq topic of `connection_ready`. */
export const CONNECTION_READY_TOPIC = "connection_ready"

/** The queue of the `bank_feed_poll` consumer of `connection_ready`. */
export const CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE = "connection_ready__bank_feed_poll"

/** The queue of the `zalo_inbox_poll` consumer of `connection_ready`. */
export const CONNECTION_READY_ZALO_INBOX_POLL_TOPIC_QUEUE = "connection_ready__zalo_inbox_poll"

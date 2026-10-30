// The topics and consumer queues of the event bus: each queue is a literal constant, never composed at runtime (R336). The names are
// declared by the event-bus migration, which creates `<topic>__<consumer>` and `<topic>__<consumer>__dead` and binds the queue to its
// topic (R258); a topic is the event name a publisher sends to. A new consumer adds a constant here and a migration, nothing else.

/** The event name and pgmq topic of `event_bus_probe`. */
export const EVENT_BUS_PROBE_TOPIC = "event_bus_probe"

/** The event name and pgmq topic of `bank_credit_booked`. */
export const BANK_CREDIT_BOOKED_TOPIC = "bank_credit_booked"

/** The queue of the `accounting` consumer of `bank_credit_booked`. */
export const BANK_CREDIT_BOOKED_ACCOUNTING_TOPIC_QUEUE = "bank_credit_booked__accounting"

/** The event name and pgmq topic of `payment_reconciled`. */
export const PAYMENT_RECONCILED_TOPIC = "payment_reconciled"

/** The queue of the `contracts` consumer of `payment_reconciled`. */
export const PAYMENT_RECONCILED_CONTRACTS_TOPIC_QUEUE = "payment_reconciled__contracts"

/** The queue of the `automations` consumer of `payment_reconciled`. */
export const PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE = "payment_reconciled__automations"

/** The queue of the `payment_receipts` consumer of `payment_reconciled`. */
export const PAYMENT_RECONCILED_PAYMENT_RECEIPTS_TOPIC_QUEUE = "payment_reconciled__payment_receipts"

/** The queue of the `care` consumer of `payment_reconciled`. */
export const PAYMENT_RECONCILED_CARE_TOPIC_QUEUE = "payment_reconciled__care"

/** The event name and pgmq topic of `lead_captured`. */
export const LEAD_CAPTURED_TOPIC = "lead_captured"

/** The queue of the `automations` consumer of `lead_captured`. */
export const LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE = "lead_captured__automations"

/** The event name and pgmq topic of `deal_won`. */
export const DEAL_WON_TOPIC = "deal_won"

/** The queue of the `automations` consumer of `deal_won`. */
export const DEAL_WON_AUTOMATIONS_TOPIC_QUEUE = "deal_won__automations"

/** The event name and pgmq topic of `order_confirmed`. */
export const ORDER_CONFIRMED_TOPIC = "order_confirmed"

/** The queue of the `automations` consumer of `order_confirmed`. */
export const ORDER_CONFIRMED_AUTOMATIONS_TOPIC_QUEUE = "order_confirmed__automations"

/** The queue of the `inventory` consumer of `order_confirmed`. */
export const ORDER_CONFIRMED_INVENTORY_TOPIC_QUEUE = "order_confirmed__inventory"

/** The event name and pgmq topic of `order_shipped`. */
export const ORDER_SHIPPED_TOPIC = "order_shipped"

/** The queue of the `automations` consumer of `order_shipped`. */
export const ORDER_SHIPPED_AUTOMATIONS_TOPIC_QUEUE = "order_shipped__automations"

/** The event name and pgmq topic of `decision_made`. */
export const DECISION_MADE_TOPIC = "decision_made"

/** The queue of the `automations` consumer of `decision_made`. */
export const DECISION_MADE_AUTOMATIONS_TOPIC_QUEUE = "decision_made__automations"

/** The event name and pgmq topic of `approval_resolved`. */
export const APPROVAL_RESOLVED_TOPIC = "approval_resolved"

/** The queue of the `thread_outcomes` consumer of `approval_resolved`. */
export const APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE = "approval_resolved__thread_outcomes"

/** The event name and pgmq topic of `booking_status_changed`. */
export const BOOKING_STATUS_CHANGED_TOPIC = "booking_status_changed"

/** The queue of the `booking_effects` consumer of `booking_status_changed`. */
export const BOOKING_STATUS_CHANGED_BOOKING_EFFECTS_TOPIC_QUEUE = "booking_status_changed__booking_effects"

/** The event name and pgmq topic of `ai_generation_completed`. */
export const AI_GENERATION_COMPLETED_TOPIC = "ai_generation_completed"

/** The queue of the `content` consumer of `ai_generation_completed`. */
export const AI_GENERATION_COMPLETED_CONTENT_TOPIC_QUEUE = "ai_generation_completed__content"

/** The queue of the `video` consumer of `ai_generation_completed`. */
export const AI_GENERATION_COMPLETED_VIDEO_TOPIC_QUEUE = "ai_generation_completed__video"

/** The event name and pgmq topic of `installation_changed`. */
export const INSTALLATION_CHANGED_TOPIC = "installation_changed"

/** The queue of the `agent_sync` consumer of `installation_changed`. */
export const INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE = "installation_changed__agent_sync"

/** The event name and pgmq topic of `knowledge_source_indexed`. */
export const KNOWLEDGE_SOURCE_INDEXED_TOPIC = "knowledge_source_indexed"

/** The queue of the `brain` consumer of `knowledge_source_indexed`. */
export const KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE = "knowledge_source_indexed__brain"

/** The columns of a booking the effects and the notices read, selected as `EffectsBaseFacts` with its instants as epoch milliseconds. */
export const EFFECTS_COLUMNS = [
    "b.id AS id",
    "b.workspaceId AS workspace_id",
    "b.status AS status",
    "b.leadId AS lead_id",
    "b.conversationId AS conversation_id",
    "b.customerName AS customer_name",
    "b.customerPhone AS customer_phone",
    "b.customerEmail AS customer_email",
    "b.cancelReason AS cancel_reason",
    "b.rescheduleCount AS reschedule_count",
    "b.holdsSlot AS holds_slot",
    "b.serviceId AS service_id",
    "b.resourceId AS resource_id",
    "CAST(b.priceVnd AS float8) AS price_vnd",
    "CAST(b.cancelFeeVnd AS float8) AS cancel_fee_vnd",
    "CAST(b.depositVnd AS float8) AS deposit_vnd",
    "CAST(extract(epoch FROM b.startAt) * 1000 AS float8) AS start_ms",
    "CAST(extract(epoch FROM b.cancelledAt) * 1000 AS float8) AS cancelled_ms",
    "CAST(extract(epoch FROM b.rescheduledFrom) * 1000 AS float8) AS from_ms",
]

/** The booking of a workspace, by its id. */
export const EFFECTS_WHERE = "b.workspaceId = :workspaceId AND b.id = :bookingId"

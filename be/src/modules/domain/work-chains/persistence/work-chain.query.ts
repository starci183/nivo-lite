/** The columns a step read selects, as the contract carries them. */
export const STEP_COLUMNS = [
    "s.id AS id",
    "s.seq AS seq",
    "s.actor_kind AS actor_kind",
    "s.actor_id AS actor_id",
    "s.kind AS kind",
    "s.action AS action",
    "s.detail AS detail",
    "s.rule AS rule",
    "s.target AS target",
    "s.approval_request_id AS approval_request_id",
    "s.status AS status",
    "s.decided_by AS decided_by",
    "s.started_at AS started_at",
    "s.finished_at AS finished_at",
]

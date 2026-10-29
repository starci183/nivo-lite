/** An item nobody touched since it was written, or whose last touch is older than the lease: free to take. */
export const FREE_TO_TAKE =
    "(w.updated_at = w.created_at OR w.updated_at < CAST(:now AS timestamptz) - make_interval(secs => CAST(:lease AS int)))"

/** The same rule for the guarded updates, which have no alias. */
export const FREE_TO_TAKE_UNALIASED =
    "(updated_at = created_at OR updated_at < CAST(:now AS timestamptz) - make_interval(secs => CAST(:lease AS int)))"

/** The columns of the accounting book's lineage read. */
export const ACCOUNTING_COLUMNS = [
    "w.id AS id",
    "w.action AS action",
    "w.status AS status",
    "w.subject_type AS subject_type",
    "w.subject_id AS subject_id",
    "to_json(w.created_at) #>> '{}' AS created_at",
]

/** The most steps one customer journey read returns. */
export const LEAD_ITEMS_MAX = 500

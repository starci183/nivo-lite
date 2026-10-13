/** The failure codes the content writers return; each has an `err_<code>` message in the catalog. */
export const CONTENT_ERROR_CODES: ReadonlyArray<string> = [
    "role",
    "item_not_found",
    "wrong_status",
    "channels_required",
    "title_required",
    "month_invalid",
    "date_invalid",
    "time_invalid",
    "pillar_duplicate",
    "channel_invalid",
    "url_invalid",
    "plan_no_pillars",
    "plan_no_cadence",
    "plan_no_slots",
    "ai_busy",
    "ai_quota",
    "not_drafted",
    "ai_unreadable",
    "ai_empty",
    "drafting_off",
    "topic_short",
    "text_missing",
    "frozen",
    "delete_status",
    "transition_status",
    "published_locked",
    "upload_bad",
    "gate_failed",
    "input",
]

/** The failure a writer returned. */
export interface ContentFailure {
    readonly kind: string
    readonly code: string
}

/** The catalog key that explains a failure to the member. */
export const errorKey = (failure: ContentFailure): string => {
    if (CONTENT_ERROR_CODES.includes(failure.code)) return `err_${failure.code}`
    if (failure.kind === "refused") return "err_refused"
    return "err_unknown"
}

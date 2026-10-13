// The catalogue of installable agents as the front end reads it synchronously. The source of truth is the typed catalogue of the back end
// (be/src/modules/domain/modules, served by GET /modules); this mirror stays until every consumer reads the api (Wave 3).

/** The module keys in display order. */
export const MODULE_KEYS = [
    "chatbot",
    "lead_gen",
    "sales",
    "accounting",
    "shifts",
    "booking",
    "inventory",
    "loyalty",
    "video",
    "content",
    "hiring",
] as const
/** The key of one module type. */
export type ModuleKey = (typeof MODULE_KEYS)[number]

/** The authority action keys of every module. */
export const ACTION_KEYS = [
    "reply_customer",
    "handoff_lead",
    "capture_lead",
    "greet_prospect",
    "ask_qualifying",
    "score_lead",
    "reply_comment_public",
    "private_reply_comment",
    "send_lead_offer",
    "quote_custom_price",
    "handoff_to_sales",
    "follow_up_lead",
    "close_lead",
    "message_with_human_agent_tag",
    "message_outside_window",
    "hide_or_delete_comment",
    "classify_lead",
    "send_follow_up",
    "send_quote",
    "confirm_order",
    "send_care",
    "issue_invoice",
    "reconcile_payment",
    "send_email",
    "publish_schedule",
    "approve_swap",
    "approve_leave",
    "remind_shift",
    "confirm_booking",
    "reschedule",
    "cancel_with_fee",
    "cancel_booking",
    "remind_booking",
    "draft_purchase_order",
    "send_purchase_order",
    "adjust_stock",
    "award_points",
    "redeem_reward",
    "send_promo",
    "adjust_points",
    "render_draft",
    "publish_video",
    "draft_post",
    "publish_post",
    "screen_candidate",
    "schedule_interview",
    "send_offer",
] as const
/** The key of one authority action. */
export type ActionKey = (typeof ACTION_KEYS)[number]

/** The category keys of the catalogue. */
export type ModuleCategoryKey = "sales_customer" | "operations" | "finance" | "marketing" | "hr"

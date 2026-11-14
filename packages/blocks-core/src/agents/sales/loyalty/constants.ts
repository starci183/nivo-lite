/** The ledger entries a member detail looks through. */
export const TIMELINE_ROWS = 200

/** The newest campaigns the promotions view lists. */
export const CAMPAIGNS_SHOWN = 20

/** The most waiting decisions a read looks through. */
export const DECISIONS_LIMIT = 100

/** The most waiting decisions the overview region lists. */
export const WAITING_SHOWN = 5

/** The days the statistics look back over. */
export const WINDOW_DAYS = 30

/** The id of the view that lists the decisions that wait. */
export const PENDING_VIEW_ID = "pending"

/** The work item actions the Loyalty view decides. */
export const LOYALTY_DECISION_ACTIONS: ReadonlyArray<string> = [
    "award_points",
    "redeem_reward",
    "send_promo",
    "adjust_points",
]

/** The commands a decision row offers: the main one and the one in the menu. */
export const DECISION_COMMANDS = { approve: "approve", reject: "reject" } as const

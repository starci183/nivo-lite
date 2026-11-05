/** The permission to see the programme, its members, rewards and campaigns, and to redeem a reward at the counter. */
export const LOYALTY_VIEW = "loyalty.view"

/** The permission to change the programme, the catalogue and the members, to adjust points and to draft promotions. */
export const LOYALTY_MANAGE = "loyalty.manage"

/** The permission to decide the loyalty work items that wait for a person. */
export const LOYALTY_DECIDE = "loyalty.decide"

/** The permissions the Loyalty module declares. */
export const LOYALTY_PERMISSIONS: ReadonlyArray<string> = [LOYALTY_VIEW, LOYALTY_MANAGE, LOYALTY_DECIDE]

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

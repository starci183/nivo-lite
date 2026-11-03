import type { WorkbenchDeclaration } from "@nivo-lite/agent-sdk/workbench/contract"

/** The views of the Loyalty workbench in strip order (`?tab=`), each labelled from the module's namespace. */
export const LOYALTY_VIEW_IDS: readonly ["overview", "members", "rewards", "promo", "pending"] = [
    "overview",
    "members",
    "rewards",
    "promo",
    "pending",
]

/**
 * The Loyalty workbench: five views every member of the workspace opens (what a manager may change is decided by the back end per
 * read, `canManage`), the two permissions its commands are gated on, every host operation it runs, and the reads of its board a
 * stored spec may bind (figures, members, rewards); it exposes no action to specs yet.
 */
export const LOYALTY_WORKBENCH: WorkbenchDeclaration = {
    key: "loyalty",
    namespace: "loyalty",
    views: [
        { id: "overview", labelKey: "tab_overview" },
        { id: "members", labelKey: "tab_members" },
        { id: "rewards", labelKey: "tab_rewards" },
        { id: "promo", labelKey: "tab_promo" },
        { id: "pending", labelKey: "tab_pending" },
    ],
    permissions: ["loyalty.manage", "loyalty.decide"],
    operations: [
        "AgentDashboard",
        "LoyaltyBoard",
        "LoyaltyMember",
        "LoyaltyCampaign",
        "LoyaltyProgram",
        "AddLoyaltyPresetRewards",
        "AdjustLoyaltyPoints",
        "DraftLoyaltyCampaign",
        "PreviewLoyaltySegment",
        "RedeemLoyaltyReward",
        "RemoveLoyaltyReward",
        "SaveLoyaltyProgram",
        "SaveLoyaltyReward",
        "SyncLoyaltyMembers",
        "UpdateLoyaltyMember",
        "WorkItems",
        "DecideWorkItem",
    ],
    exposes: {
        blocks: [],
        reads: [
            {
                name: "loyalty.figures",
                module: "loyalty",
                operation: "LoyaltyBoard",
                shape: "record",
                variables: {},
                paths: { figures: "record", stats: "record" },
            },
            {
                name: "loyalty.members",
                module: "loyalty",
                operation: "LoyaltyBoard",
                shape: "record",
                variables: {},
                paths: { members: "list" },
            },
            {
                name: "loyalty.rewards",
                module: "loyalty",
                operation: "LoyaltyBoard",
                shape: "record",
                variables: {},
                paths: { rewards: "list" },
            },
        ],
        actions: [],
    },
}

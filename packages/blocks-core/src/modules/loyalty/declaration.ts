import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import {
    adjustPointsAction,
    recordPurchaseAction,
    redeemRewardAction,
    updateMemberAction,
} from "./actions/member.actions"
import { draftCampaignAction, decideAction, previewSegmentAction } from "./actions/promo.actions"
import { saveProgramAction, syncMembersAction } from "./actions/program.actions"
import { addPresetRewardsAction, removeRewardAction, saveRewardAction } from "./actions/rewards.actions"
import { LOYALTY_PERMISSIONS } from "./constants"
import { figuresRead, statsRead, tiersRead } from "./reads/board.read"
import {
    memberCountsRead,
    memberLedgerRead,
    memberRead,
    memberRewardsRead,
    membersRead,
    tierCountsRead,
} from "./reads/members.read"
import { pendingCountRead, pendingRead, pendingWaitingRead } from "./reads/pending.read"
import { campaignsRead, programRead } from "./reads/program.read"
import { rewardRead, rewardsRead } from "./reads/rewards.read"
import { LOYALTY_WORKBENCH_SPEC } from "./specs/loyalty.workbench"

/** The module key of Loyalty: every read and action id starts with it. */
export const LOYALTY_MODULE_KEY = "loyalty"

/**
 * The Loyalty module: the ribbon and statistics of the programme, the members with search and counts, one member with the points
 * ledger, the reward catalogue, the programme's rules, the promotions and the decisions that wait for the owner; and the actions
 * that change them. The seed spec draws it from the generic blocks.
 */
export const loyaltyModule: ModuleDeclaration = defineModule({
    key: LOYALTY_MODULE_KEY,
    namespace: "loyalty",
    permissions: LOYALTY_PERMISSIONS,
    reads: [
        figuresRead,
        statsRead,
        tiersRead,
        membersRead,
        memberCountsRead,
        tierCountsRead,
        memberRead,
        memberRewardsRead,
        memberLedgerRead,
        rewardsRead,
        rewardRead,
        programRead,
        campaignsRead,
        pendingRead,
        pendingWaitingRead,
        pendingCountRead,
    ],
    actions: [
        adjustPointsAction,
        updateMemberAction,
        redeemRewardAction,
        recordPurchaseAction,
        saveRewardAction,
        removeRewardAction,
        addPresetRewardsAction,
        saveProgramAction,
        syncMembersAction,
        draftCampaignAction,
        previewSegmentAction,
        decideAction,
    ],
    specs: [LOYALTY_WORKBENCH_SPEC],
})

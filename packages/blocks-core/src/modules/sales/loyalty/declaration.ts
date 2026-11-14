import type { ActionDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import {
    adjustPointsAction,
    recordPurchaseAction,
    redeemRewardAction,
    updateMemberAction,
} from "./actions/member.actions"
import { draftCampaignAction, decideAction, previewSegmentAction } from "./actions/promo.actions"
import { saveProgramAction, syncMembersAction } from "./actions/program.actions"
import { addPresetRewardsAction, removeRewardAction, saveRewardAction } from "./actions/rewards.actions"
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

/**
 * The loyalty programme of the sale (the loyalty area of the Sales module): the ribbon and statistics of the programme, the members with
 * search and counts, one member with the points ledger, the reward catalogue, the programme's rules, the promotions and the decisions
 * that wait for the owner; and the actions that change them. The Sales module declares them beside its own; its workbench draws them.
 */

/** The loyalty area's reads. */
export const LOYALTY_READS: ReadonlyArray<ReadDefinition> = [
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
    
]

/** The loyalty area's actions. */
export const LOYALTY_ACTIONS: ReadonlyArray<ActionDefinition> = [
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
    
]

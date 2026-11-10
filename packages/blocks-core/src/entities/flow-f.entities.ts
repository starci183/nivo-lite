import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { adjustmentEntity } from "./accounting/adjustment.entity"
import { bookEntryEntity } from "./accounting/book-entry.entity"
import { accountingQuestionEntity } from "./accounting/question.entity"
import { accountingSettingsEntity } from "./accounting/settings.entity"
import { invoiceEntity } from "./accounting/invoice.entity"
import { agentGraphDecisionEntity } from "./agent/graph-decision.entity"
import { agentGraphProposalEntity } from "./agent/graph-proposal.entity"
import { agentGraphSourceEntity } from "./agent/graph-source.entity"
import { agentGraphVersionEntity } from "./agent/graph-version.entity"
import { agentGraphEntity } from "./agent/graph.entity"
import { agentWorkflowVersionEntity } from "./agent/workflow-version.entity"
import { agentWorkflowEntity } from "./agent/workflow.entity"
import { loyaltyMemberEntity } from "./loyalty/member.entity"
import { loyaltyLedgerEntryEntity } from "./loyalty/ledger-entry.entity"
import { loyaltyRewardEntity } from "./loyalty/reward.entity"
import { loyaltyProgramEntity } from "./loyalty/program.entity"
import { loyaltyCampaignEntity } from "./loyalty/campaign.entity"
import { loyaltyDecisionEntity } from "./loyalty/decision.entity"
import { agentNodeEffectEntity } from "./agent/node-effect.entity"
import { agentRunStepEntity } from "./agent/run-step.entity"
import { agentRunEntity } from "./agent/run.entity"
import { agentRunWorkflowEntity } from "./agent/run-workflow.entity"
import { agentLeadFreezeEntity } from "./agent/lead-freeze.entity"
import { agentConversationHoldEntity } from "./agent/conversation-hold.entity"
import { agentLeadMemoryEntity } from "./agent/lead-memory.entity"
import { turnEntity } from "./agent/turn.entity"
import { conversationEntity } from "./chat/conversation.entity"
import { messageEntity } from "./chat/message.entity"
import { chatSettingsEntity } from "./chat/settings.entity"
import { claimEntity } from "./payment/claim.entity"
import { transactionEntity } from "./payment/transaction.entity"
import { workspaceSettingsEntity } from "./workspace/settings.entity"
import { leadEntity } from "./sales/lead.entity"
import { orderEntity } from "./sales/order.entity"
import { salesSettingsEntity } from "./sales/settings.entity"

/** Every flow F entity declaration. */
export const FLOW_F_ENTITIES: ReadonlyArray<AnyEntityDefinition> = [
    leadEntity,
    orderEntity,
    salesSettingsEntity,
    conversationEntity,
    messageEntity,
    chatSettingsEntity,
    transactionEntity,
    claimEntity,
    invoiceEntity,
    adjustmentEntity,
    bookEntryEntity,
    accountingQuestionEntity,
    accountingSettingsEntity,
    loyaltyMemberEntity,
    loyaltyLedgerEntryEntity,
    loyaltyRewardEntity,
    loyaltyProgramEntity,
    loyaltyCampaignEntity,
    loyaltyDecisionEntity,
    turnEntity,
    agentRunEntity,
    agentRunStepEntity,
    agentNodeEffectEntity,
    agentGraphEntity,
    agentGraphVersionEntity,
    agentGraphSourceEntity,
    agentGraphProposalEntity,
    agentGraphDecisionEntity,
    agentWorkflowEntity,
    agentWorkflowVersionEntity,
    agentRunWorkflowEntity,
    agentLeadFreezeEntity,
    agentConversationHoldEntity,
    agentLeadMemoryEntity,
    workspaceSettingsEntity,
]

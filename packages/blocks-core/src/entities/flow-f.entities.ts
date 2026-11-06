import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { adjustmentEntity } from "./accounting/adjustment.entity"
import { bookEntryEntity } from "./accounting/book-entry.entity"
import { invoiceEntity } from "./accounting/invoice.entity"
import { loyaltyMemberEntity } from "./loyalty/member.entity"
import { loyaltyLedgerEntryEntity } from "./loyalty/ledger-entry.entity"
import { loyaltyRewardEntity } from "./loyalty/reward.entity"
import { loyaltyProgramEntity } from "./loyalty/program.entity"
import { loyaltyCampaignEntity } from "./loyalty/campaign.entity"
import { loyaltyDecisionEntity } from "./loyalty/decision.entity"
import { agentNodeEffectEntity } from "./agent/node-effect.entity"
import { agentRunStepEntity } from "./agent/run-step.entity"
import { agentRunEntity } from "./agent/run.entity"
import { turnEntity } from "./agent/turn.entity"
import { conversationEntity } from "./chat/conversation.entity"
import { messageEntity } from "./chat/message.entity"
import { claimEntity } from "./payment/claim.entity"
import { transactionEntity } from "./payment/transaction.entity"
import { leadEntity } from "./sales/lead.entity"
import { orderEntity } from "./sales/order.entity"

/** Every flow F entity declaration. */
export const FLOW_F_ENTITIES: ReadonlyArray<AnyEntityDefinition> = [
    leadEntity,
    orderEntity,
    conversationEntity,
    messageEntity,
    transactionEntity,
    claimEntity,
    invoiceEntity,
    adjustmentEntity,
    bookEntryEntity,
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
]

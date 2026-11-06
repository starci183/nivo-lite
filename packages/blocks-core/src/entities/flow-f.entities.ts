import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { adjustmentEntity } from "./accounting/adjustment.entity"
import { bookEntryEntity } from "./accounting/book-entry.entity"
import { invoiceEntity } from "./accounting/invoice.entity"
import { agentNodeEffectEntity } from "./agent/node-effect.entity"
import { agentRunStepEntity } from "./agent/run-step.entity"
import { agentRunEntity } from "./agent/run.entity"
import { turnEntity } from "./agent/turn.entity"
import { conversationEntity } from "./chat/conversation.entity"
import { messageEntity } from "./chat/message.entity"
import { claimEntity } from "./payment/claim.entity"
import { transactionEntity } from "./payment/transaction.entity"
import { workspaceSettingsEntity } from "./workspace/settings.entity"
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
    turnEntity,
    agentRunEntity,
    agentRunStepEntity,
    agentNodeEffectEntity,
    workspaceSettingsEntity,
]

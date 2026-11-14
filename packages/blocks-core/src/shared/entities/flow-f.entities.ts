import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { adjustmentEntity } from "../../agents/sales/entities/ledger-adjustment.entity"
import { bookEntryEntity } from "../../agents/sales/entities/ledger-entry.entity"
import { salesLedgerQuestionEntity } from "../../agents/sales/entities/ledger-question.entity"
import { salesLedgerSettingsEntity } from "../../agents/sales/entities/ledger-settings.entity"
import { invoiceEntity } from "../../agents/sales/entities/invoice.entity"
import { bookingEntity } from "../../agents/booking/entities/booking.entity"
import { bookingHoursEntity } from "../../agents/booking/entities/hours.entity"
import { bookingResourceEntity } from "../../agents/booking/entities/resource.entity"
import { bookingServiceEntity } from "../../agents/booking/entities/service.entity"
import { bookingSettingsEntity } from "../../agents/booking/entities/settings.entity"
import { loyaltyMemberEntity } from "../../agents/sales/entities/loyalty-member.entity"
import { loyaltyLedgerEntryEntity } from "../../agents/sales/entities/loyalty-ledger-entry.entity"
import { loyaltyRewardEntity } from "../../agents/sales/entities/loyalty-reward.entity"
import { loyaltyProgramEntity } from "../../agents/sales/entities/loyalty-program.entity"
import { loyaltyCampaignEntity } from "../../agents/sales/entities/loyalty-campaign.entity"
import { loyaltyDecisionEntity } from "../../agents/sales/entities/loyalty-decision.entity"
import { conversationEntity } from "../../agents/chatbot/entities/conversation.entity"
import { contentBrandEntity } from "../../agents/content/entities/brand.entity"
import { contentPostEntity } from "../../agents/content/entities/post.entity"
import { noteEntity } from "../../agents/chatbot/entities/note.entity"
import { replyEntity } from "../../agents/chatbot/entities/reply.entity"
import { chatSettingsEntity } from "../../agents/chatbot/entities/settings.entity"
import { claimEntity } from "../../agents/sales/entities/claim.entity"
import { transactionEntity } from "../../agents/sales/entities/transaction.entity"
import { hiringCandidateEntity } from "../../agents/hiring/entities/candidate.entity"
import { hiringJobEntity } from "../../agents/hiring/entities/job.entity"
import { leadEntity } from "../../agents/sales/entities/lead.entity"
import { orderEntity } from "../../agents/sales/entities/order.entity"
import { salesSettingsEntity } from "../../agents/sales/entities/settings.entity"
import { videoBrandKitEntity } from "../../agents/video/entities/brand-kit.entity"
import { videoProjectEntity } from "../../agents/video/entities/project.entity"
import { videoRenderEntity } from "../../agents/video/entities/render.entity"

/** Every flow F entity declaration. */
export const FLOW_F_ENTITIES: ReadonlyArray<AnyEntityDefinition> = [
    leadEntity,
    orderEntity,
    salesSettingsEntity,
    conversationEntity,
    noteEntity,
    replyEntity,
    chatSettingsEntity,
    transactionEntity,
    claimEntity,
    invoiceEntity,
    adjustmentEntity,
    bookEntryEntity,
    salesLedgerQuestionEntity,
    salesLedgerSettingsEntity,
    loyaltyMemberEntity,
    loyaltyLedgerEntryEntity,
    loyaltyRewardEntity,
    loyaltyProgramEntity,
    loyaltyCampaignEntity,
    loyaltyDecisionEntity,
    bookingServiceEntity,
    bookingResourceEntity,
    bookingHoursEntity,
    bookingEntity,
    bookingSettingsEntity,
    videoProjectEntity,
    videoRenderEntity,
    videoBrandKitEntity,
    hiringJobEntity,
    hiringCandidateEntity,
    contentBrandEntity,
    contentPostEntity,
]

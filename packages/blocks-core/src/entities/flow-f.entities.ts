import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { adjustmentEntity } from "./sales/ledger-adjustment.entity"
import { bookEntryEntity } from "./sales/ledger-entry.entity"
import { salesLedgerQuestionEntity } from "./sales/ledger-question.entity"
import { salesLedgerSettingsEntity } from "./sales/ledger-settings.entity"
import { invoiceEntity } from "./sales/invoice.entity"
import { bookingEntity } from "./booking/booking.entity"
import { bookingHoursEntity } from "./booking/hours.entity"
import { bookingResourceEntity } from "./booking/resource.entity"
import { bookingServiceEntity } from "./booking/service.entity"
import { bookingSettingsEntity } from "./booking/settings.entity"
import { loyaltyMemberEntity } from "./sales/loyalty-member.entity"
import { loyaltyLedgerEntryEntity } from "./sales/loyalty-ledger-entry.entity"
import { loyaltyRewardEntity } from "./sales/loyalty-reward.entity"
import { loyaltyProgramEntity } from "./sales/loyalty-program.entity"
import { loyaltyCampaignEntity } from "./sales/loyalty-campaign.entity"
import { loyaltyDecisionEntity } from "./sales/loyalty-decision.entity"
import { conversationEntity } from "./chat/conversation.entity"
import { contentBrandEntity } from "./content/brand.entity"
import { contentPostEntity } from "./content/post.entity"
import { noteEntity } from "./chat/note.entity"
import { replyEntity } from "./chat/reply.entity"
import { chatSettingsEntity } from "./chat/settings.entity"
import { claimEntity } from "./sales/claim.entity"
import { transactionEntity } from "./sales/transaction.entity"
import { hiringCandidateEntity } from "./hiring/candidate.entity"
import { hiringJobEntity } from "./hiring/job.entity"
import { leadEntity } from "./sales/lead.entity"
import { orderEntity } from "./sales/order.entity"
import { salesSettingsEntity } from "./sales/settings.entity"
import { videoBrandKitEntity } from "./video/brand-kit.entity"
import { videoProjectEntity } from "./video/project.entity"
import { videoRenderEntity } from "./video/render.entity"

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

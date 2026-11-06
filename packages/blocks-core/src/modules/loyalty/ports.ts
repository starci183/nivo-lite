import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { entityPort } from "@nivo-lite/agent-sdk/entity/port"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { conversationEntity } from "../../entities/chat/conversation.entity"
import { loyaltyCampaignEntity } from "../../entities/loyalty/campaign.entity"
import { loyaltyDecisionEntity } from "../../entities/loyalty/decision.entity"
import { loyaltyLedgerEntryEntity } from "../../entities/loyalty/ledger-entry.entity"
import { loyaltyMemberEntity } from "../../entities/loyalty/member.entity"
import { loyaltyProgramEntity } from "../../entities/loyalty/program.entity"
import { loyaltyRewardEntity } from "../../entities/loyalty/reward.entity"
import { leadEntity } from "../../entities/sales/lead.entity"
import type { MemberListRow } from "./loyalty.types"

/*
 * The data of the Loyalty module is the engine's: every row is a record of an entity read and written through its entity port, the
 * outbox and the door are the engine's. Only the list source below is the module's own slot, the id every list read of a module has.
 */

/** The port of the customers of the programme (`loyalty.member`). */
export const MEMBERS: PortDefinition<EntityApi> = entityPort(loyaltyMemberEntity)

/** The port of the append-only points ledger (`loyalty.ledger-entry`). */
export const LEDGER: PortDefinition<EntityApi> = entityPort(loyaltyLedgerEntryEntity)

/** The port of the reward catalogue (`loyalty.reward`). */
export const REWARDS: PortDefinition<EntityApi> = entityPort(loyaltyRewardEntity)

/** The port of the programme of the workspace (`loyalty.program`), one row. */
export const PROGRAM: PortDefinition<EntityApi> = entityPort(loyaltyProgramEntity)

/** The port of the promotions (`loyalty.campaign`). */
export const CAMPAIGNS: PortDefinition<EntityApi> = entityPort(loyaltyCampaignEntity)

/** The port of the decisions that wait for a person (`loyalty.decision`). */
export const DECISIONS: PortDefinition<EntityApi> = entityPort(loyaltyDecisionEntity)

/** The port of the customers of the Sales module (`sales.lead`), which a sync makes members of. */
export const LEADS: PortDefinition<EntityApi> = entityPort(leadEntity)

/** The port of the conversations of the Chatbot module (`chat.conversation`), which tell whether a promotion can reach a customer. */
export const CONVERSATIONS: PortDefinition<EntityApi> = entityPort(conversationEntity)

/** The port the members list runs on: the engine turns a list shape and a query into one query over `loyalty.member`. */
export const loyaltyMembersList: PortDefinition<ListSource<MemberListRow>> =
    definePort<ListSource<MemberListRow>>("loyalty.members-list")

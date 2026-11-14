import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import { loyaltyCampaignEntity } from "../entities/loyalty-campaign.entity"
import { loyaltyDecisionEntity } from "../entities/loyalty-decision.entity"
import { loyaltyLedgerEntryEntity } from "../entities/loyalty-ledger-entry.entity"
import { loyaltyMemberEntity } from "../entities/loyalty-member.entity"
import { loyaltyProgramEntity } from "../entities/loyalty-program.entity"
import { loyaltyRewardEntity } from "../entities/loyalty-reward.entity"
import { leadEntity } from "../entities/lead.entity"
import type { MemberListRow } from "./loyalty.types"

/*
 * The data of the Loyalty module is the engine's: every row is a record of an entity read and written through its entity port, the
 * outbox and the door are the engine's. Only the list source below is the module's own slot, the id every list read of a module has.
 */

/** The port of the customers of the programme (`blocks-core.sales.api.loyalty-member.get`). */
export const MEMBERS: PortDefinition<EntityApi> = entityPort(loyaltyMemberEntity)

/** The port of the append-only points ledger (`loyalty.ledger-entry`). */
export const LEDGER: PortDefinition<EntityApi> = entityPort(loyaltyLedgerEntryEntity)

/** The port of the reward catalogue (`blocks-core.sales.api.loyalty-reward.get`). */
export const REWARDS: PortDefinition<EntityApi> = entityPort(loyaltyRewardEntity)

/** The port of the programme of the workspace (`blocks-core.sales.api.loyalty-program.get`), one row. */
export const PROGRAM: PortDefinition<EntityApi> = entityPort(loyaltyProgramEntity)

/** The port of the promotions (`loyalty.campaign`). */
export const CAMPAIGNS: PortDefinition<EntityApi> = entityPort(loyaltyCampaignEntity)

/** The port of the decisions that wait for a person (`loyalty.decision`). */
export const DECISIONS: PortDefinition<EntityApi> = entityPort(loyaltyDecisionEntity)

/** The port of the customers of the Sales module (`blocks-core.sales.lead`), which a sync makes members of. */
export const LEADS: PortDefinition<EntityApi> = entityPort(leadEntity)


/** The port the members list runs on: the engine turns a list shape and a query into one query over `blocks-core.sales.api.loyalty-member.get`. */
export const loyaltyMembersList: PortDefinition<ListSource<MemberListRow>> =
    definePort<ListSource<MemberListRow>>("sales.loyalty-members-list")

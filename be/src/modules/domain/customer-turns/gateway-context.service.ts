import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { InjectInstallations } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { CapabilityRole, GatewayCaller, GatewayJson } from "@modules/domain/mcp-gateway"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CapturedLead } from "./customer-turns.contracts"
import type { OptionalPartyContext, PartyContext } from "./gateway-turns.contracts"

const LOCALE = "vi"
/** The installation setting that names how the workspace matches a customer to a connector's party. */
const MATCH_SETTING = "identity_match"
/** The channel name a phone identity is looked up under, when the workspace matches customers by phone. */
const PHONE_CHANNEL = "phone"

/** How a customer is matched to a connector's party: by their identity on the chat channel, or by the phone they gave. */
type IdentityMatch = "channel" | "phone"

/** One identity a role is called with. */
interface IdentityKey {
    /** The channel: the chat channel, or `phone`. */
    readonly channel: string
    /** The id on it: the channel user id, or the phone. */
    readonly externalId: string
}

const textAt = (value: GatewayJson, key: string): string => {
    const member = value[key]
    return typeof member === "string" ? member : ""
}

/** The customer's id on the channel without the archive suffix NIVO adds after a colon. */
const channelUserOf = (externalId: string): string => externalId.replace(/:.*$/su, "")

@Injectable()
/**
 * The connector part of a customer turn that NIVO runs itself, through capability roles only (no connector or tool name): who the
 * customer is, the clause that lets the agent use the gateway meta-tools, and the party a connector creates once the customer gave
 * their name. The party is remembered on the conversation, so a connector is asked once; how a customer is matched (their chat
 * identity, or their phone across channels) is the workspace's own setting `identity_match` of the agent's installation. No
 * connector playing a role, or one that fails, keeps the turn as it is; an owner's test chat creates no party.
 */
export class GatewayContextService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        private readonly gateway: McpGatewayService,
        private readonly conversations: AgentConversationsService,
    ) {}

    /** True when the conversation's agent holds any connector grant other than never. */
    async servesConnectors(conversation: TurnConversation): Promise<boolean> {
        const grants = await this.gateway.grantsOf(conversation.workspaceId, conversation.agent.id)
        return grants.some((grant) => grant.mode !== "never")
    }

    /**
     * The party of the conversation's customer: the remembered one, else (matching by channel) the one `identity.find` answers for
     * the channel identity; null when none is known yet and no connector can tell.
     */
    async partyOf(conversation: TurnConversation): Promise<OptionalPartyContext> {
        const remembered = await this.conversations.partyOf(conversation.workspaceId, conversation.id)
        if (remembered !== null) return { found: true, partyId: remembered.partyId, name: remembered.name }
        if (conversation.externalId === null || (await this.matchOf(conversation)) !== "channel") return null
        return this.find(conversation, {
            channel: conversation.channel,
            externalId: channelUserOf(conversation.externalId),
        })
    }

    /** The context lines the AI step may use: the connector clause, and who the customer is when a connector knows them. */
    briefOf(party: OptionalPartyContext): ReadonlyArray<string> {
        const contract = this.catalog.get("gatewayTurns.contract", {}, LOCALE)
        if (party === null || !party.found) return [contract]
        return [contract, this.catalog.get("gatewayTurns.partyKnown", { name: party.name || "-" }, LOCALE)]
    }

    /**
     * Makes the customer who gave their name a party of the connector: the one `identity.find` answers for their key (the chat
     * identity, or the phone), else the one `identity.upsert` creates, keyed by the message so a replayed turn creates nobody twice.
     */
    async remember(conversation: TurnConversation, lead: CapturedLead, messageId: string): Promise<void> {
        if (await this.conversations.isTestChat(conversation.id)) return
        if ((await this.conversations.partyOf(conversation.workspaceId, conversation.id)) !== null) return
        const key = await this.keyOf(conversation, lead)
        if (key === null) return
        const found = await this.find(conversation, key)
        if (found?.found === true) return
        const tool = await this.toolFor(conversation, "identity.upsert")
        if (tool === null) return
        const upserted = await this.gateway.call(
            { ...this.callerOf(conversation), opKey: `${messageId}:identity.upsert` },
            tool,
            { ...key, name: lead.contactName, ...(lead.phone === null ? {} : { phone: lead.phone }) },
        )
        const partyId = upserted.ok ? textAt(upserted.value, "partyId") : ""
        if (partyId !== "") await this.rememberParty(conversation, partyId, lead.contactName)
    }

    /** The identity the workspace matches this customer by; null while it is not known (no channel identity, or no phone yet). */
    private async keyOf(conversation: TurnConversation, lead: CapturedLead): Promise<IdentityKey | null> {
        if ((await this.matchOf(conversation)) === "phone") {
            return lead.phone === null ? null : { channel: PHONE_CHANNEL, externalId: lead.phone }
        }
        if (conversation.externalId === null) return null
        return { channel: conversation.channel, externalId: channelUserOf(conversation.externalId) }
    }

    /** How the workspace matches customers for the conversation's agent; by channel unless its installation says `phone`. */
    private async matchOf(conversation: TurnConversation): Promise<IdentityMatch> {
        const installation = await this.installations.ofAgent(conversation.workspaceId, conversation.agent.id)
        return installation?.settings[MATCH_SETTING] === PHONE_CHANNEL ? "phone" : "channel"
    }

    /** The party `identity.find` answers for a key, remembered on the conversation when found; null without the role or on failure. */
    private async find(conversation: TurnConversation, key: IdentityKey): Promise<OptionalPartyContext> {
        const tool = await this.toolFor(conversation, "identity.find")
        if (tool === null) return null
        const found = await this.gateway.call(this.callerOf(conversation), tool, { ...key })
        if (!found.ok) return null
        const partyId = textAt(found.value, "partyId")
        const party: PartyContext = {
            found: found.value.found === true && partyId !== "",
            partyId: partyId === "" ? null : partyId,
            name: textAt(found.value, "name"),
        }
        if (party.found) await this.rememberParty(conversation, partyId, party.name)
        return party
    }

    private async toolFor(conversation: TurnConversation, role: CapabilityRole): Promise<string | null> {
        const resolved = await this.gateway.toolForRole(conversation.workspaceId, role)
        return resolved.ok ? resolved.tool.name : null
    }

    private async rememberParty(conversation: TurnConversation, partyId: string, name: string): Promise<void> {
        await this.conversations.rememberParty({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            party: { partyId, name },
        })
    }

    /** The gateway caller of a conversation's agent. */
    private callerOf(conversation: TurnConversation): GatewayCaller {
        return {
            workspaceId: conversation.workspaceId,
            agentId: conversation.agent.id,
            conversationId: conversation.id,
            workItemId: null,
        }
    }
}

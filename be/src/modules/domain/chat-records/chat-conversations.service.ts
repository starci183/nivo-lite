import { Injectable } from "@nestjs/common"
import { AgentDirectoryService, InjectInstallations } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { patchAfterHandling } from "@nivo-lite/blocks-core/rules/chatbot"
import { ChatEntitiesService } from "./chat-entities.service"
import { followersOf } from "./chat-followers.policy"
import { MESSAGE_SELECT, linesOf } from "./chat-lines.policy"
import {
    CONVERSATION_ENTITY,
    byCustomer,
    byId,
    conversationQuery,
    factsOf,
    humanOf,
    oneConversationQuery,
    partyOfFacts,
    refOf,
    stateOf,
    targetOf,
} from "./chat-conversation.policy"
import type { ConversationFacts } from "./chat-conversation.policy"
import type {
    ChatConversationParty,
    ChatConversationRef,
    ChatConversationTarget,
    ChatFollower,
    ChatFollowerQuery,
    ChatHumanConversation,
    Met,
    ChatOpenConversation,
    OptionalChatConversationParty,
    OptionalHolder,
    OptionalChatHumanConversation,
    OptionalChatInstallationId,
    OptionalChatLeadId,
    ChatTurnConversation,
} from "./chat-records.contracts"
import { ChatRecordsError, ChatRecordsErrorCode } from "./errors/chat-records.error"

/** How often a write starts again after another writer moved the conversation first. */
const WRITE_ATTEMPTS = 3

/** The most conversations and lines one follower read looks at. */
const FOLLOWERS_MAX = 100

/** The most records one page of a query holds. */
const PAGE_MAX = 100

/** How many pages of the newest conversations a read by lead looks through. */
const LEAD_SCAN_PAGES = 20

/** The values a change writes. */
type Change = Readonly<Record<string, string | boolean | number | null>>

@Injectable()
/**
 * The conversations customers have with the workspace's agents on a channel, as `chat.conversation` records; the only be code that
 * writes them. Every method takes the workspace first and runs in one scoped engine transaction.
 */
export class ChatConversationsService {
    constructor(
        private readonly entities: ChatEntitiesService,
        private readonly agents: AgentDirectoryService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The conversation of one customer on one connection, or a refusal when they never wrote. */
    find(
        workspaceId: string,
        channel: string,
        connectionId: string,
        customerId: string,
    ): Promise<Outcome<ChatConversationRef, ChatRecordsErrorCode>> {
        return this.entities.run(workspaceId, async (api) => {
            const facts = await this.readOne(api, byCustomer(channel, connectionId, customerId))
            return facts === null ? refused(ChatRecordsErrorCode.NotFound) : ok(refOf(facts))
        })
    }

    /**
     * The conversation of a customer on a connection: found, or opened on the first message, and followed to the agent that is the
     * connection's front door now. A second meeting of the same customer finds the same conversation (the declared key).
     */
    meet(input: ChatOpenConversation): Promise<Met> {
        return this.entities.run(input.workspaceId, async (api) => {
            const ensured = await api.ensure(CONVERSATION_ENTITY, "channel_external", {
                channel: input.channel,
                connectionId: input.connectionId,
                externalId: input.customerId,
                name: input.visitor,
                agentId: input.agentId,
            })
            if (!ensured.ok) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
            const created = ensured.created === true
            if (!created && ensured.row.data["agentId"] !== input.agentId)
                await this.change(api, ensured.row.id, () => ({ agentId: input.agentId }), WRITE_ATTEMPTS)
            const facts = await this.readOne(api, byId(ensured.row.id))
            if (facts === null) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
            return { conversation: refOf(facts), created }
        })
    }

    /**
     * The conversation follows an agent that keeps it (a workflow holding the customer past the front door): from now on that agent holds the
     * right to speak in it. The next meeting of the customer gives it back to the front door unless the keeper takes it again.
     */
    follow(workspaceId: string, conversationId: string, agentId: string): Promise<void> {
        return this.entities.run(workspaceId, (api) =>
            this.change(api, conversationId, () => ({ agentId }), WRITE_ATTEMPTS),
        )
    }

    /** "/start" opens a fresh visit: the previous conversation of the customer stays in history under the archived id. */
    archive(
        workspaceId: string,
        channel: string,
        connectionId: string,
        customerId: string,
        archivedId: string,
    ): Promise<void> {
        return this.entities.run(workspaceId, async (api) => {
            const facts = await this.readOne(api, byCustomer(channel, connectionId, customerId))
            if (facts !== null) await this.change(api, facts.id, () => ({ externalId: archivedId }), WRITE_ATTEMPTS)
        })
    }

    /** Names the customer of the conversation after the channel told who they are. */
    rename(workspaceId: string, conversationId: string, name: string): Promise<void> {
        return this.entities.run(workspaceId, (api) =>
            this.change(api, conversationId, () => ({ name }), WRITE_ATTEMPTS),
        )
    }

    /**
     * Ties a conversation to the lead the customer became: the `lead` link, and the `leadId` field the graph nodes read a customer's
     * conversation by (`conversation` where `leadId`), which the link alone never wrote.
     */
    attachLead(workspaceId: string, conversationId: string, leadId: string): Promise<void> {
        return this.entities.run(workspaceId, async (api) => {
            const linked = await api.link(CONVERSATION_ENTITY, conversationId, "lead", leadId)
            if (!linked.ok) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotFound })
            await this.change(api, conversationId, () => ({ leadId }), WRITE_ATTEMPTS)
        })
    }

    /** A person holds the conversation from now on (a name), or hands it back to the AI (null): the AI stays quiet while one holds it. */
    setHolder(workspaceId: string, conversationId: string, holder: OptionalHolder): Promise<void> {
        return this.entities.run(workspaceId, (api) =>
            this.change(
                api,
                conversationId,
                (facts) => ({
                    ...patchAfterHandling(stateOf(facts), holder),
                    handledAt: holder === null ? null : this.clock.now().toISOString(),
                }),
                WRITE_ATTEMPTS,
            ),
        )
    }

    /** Where the replies of the conversation go, or a refusal when it does not exist. */
    targetOf(
        workspaceId: string,
        conversationId: string,
    ): Promise<Outcome<ChatConversationTarget, ChatRecordsErrorCode>> {
        return this.entities.run(workspaceId, async (api) => {
            const facts = await this.readOne(api, byId(conversationId))
            return facts === null ? refused(ChatRecordsErrorCode.NotFound) : ok(targetOf(facts))
        })
    }

    /** The customers who wrote on a connection after a moment, newest first, one per conversation. */
    followersOn(workspaceId: string, query: ChatFollowerQuery): Promise<ReadonlyArray<ChatFollower>> {
        const since = query.since.toISOString()
        return this.entities.run(workspaceId, async (api) => {
            const conversations = await api.list(
                conversationQuery(
                    q.and(
                        q.eq("channel", query.channel),
                        q.eq("connectionId", query.connectionId),
                        q.gt("lastAt", since),
                    ),
                    FOLLOWERS_MAX,
                ),
            )
            const facts = conversations.rows.flatMap((found) => factsOf(found) ?? [])
            if (facts.length === 0) return []
            const lines = await api.list({
                from: "chat.message",
                select: MESSAGE_SELECT,
                where: q.and(
                    q.in(
                        "conversationId",
                        facts.map((one) => one.id),
                    ),
                    q.eq("role", "user"),
                    q.gt("sentAt", since),
                ),
                order: [
                    ["sentAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: FOLLOWERS_MAX },
            })
            return followersOf(
                facts,
                lines.rows.flatMap((found) => linesOf(found.row)),
            ).slice(0, query.limit)
        })
    }

    /** The customer conversation a member may hold or reply in, or null when the workspace has no such conversation. */
    humanOf(workspaceId: string, conversationId: string): Promise<OptionalChatHumanConversation> {
        return this.entities.run(workspaceId, async (api) => {
            const facts = await this.readOne(api, byId(conversationId))
            return facts === null ? null : humanOf(facts)
        })
    }

    /** The lead the conversation became; null when the conversation is another workspace's, is missing or has no lead. */
    leadIdOf(workspaceId: string, conversationId: string): Promise<OptionalChatLeadId> {
        return this.entities.run(workspaceId, async (api) => {
            const facts = await this.readOne(api, byId(conversationId))
            return facts?.leadId ?? null
        })
    }

    /** The installation of a conversation: the one of the agent that speaks in it; null when the conversation is not in the workspace or its agent has none. */
    async installationIdOf(workspaceId: string, conversationId: string): Promise<OptionalChatInstallationId> {
        const facts = await this.entities.run(workspaceId, (api) => this.readOne(api, byId(conversationId)))
        const installation = facts === null ? null : await this.installations.ofAgent(workspaceId, facts.agentId)
        return installation?.id ?? null
    }

    /** Whether the workspace holds any conversation: a customer has talked to an agent. */
    hasAny(workspaceId: string): Promise<boolean> {
        return this.entities.run(workspaceId, async (api) => (await this.readOne(api, q.ne("channel", ""))) !== null)
    }

    /** The conversations among the ids, as a member may hold them, in one read; an id that is not in the workspace is left out. */
    humansOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<ChatHumanConversation>> {
        if (ids.length === 0) return Promise.resolve([])
        const chunks = Array.from({ length: Math.ceil(ids.length / PAGE_MAX) }, (_, index) =>
            ids.slice(index * PAGE_MAX, (index + 1) * PAGE_MAX),
        )
        return this.entities.run(workspaceId, async (api) => {
            const pages = await Promise.all(
                chunks.map((chunk) => api.list(conversationQuery(q.in("id", chunk), chunk.length))),
            )
            return pages.flatMap((page) => page.rows.flatMap((found) => factsOf(found) ?? [])).map(humanOf)
        })
    }

    /**
     * The conversations tied to one of the leads, newest first. A conversation points at its lead and a record query cannot ask the other
     * way, so this reads the newest conversations page by page (at most `LEAD_SCAN_PAGES` pages) and keeps the ones tied to a wanted lead.
     */
    ofLeads(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<ReadonlyArray<ChatHumanConversation>> {
        if (leadIds.length === 0) return Promise.resolve([])
        const wanted = new Set(leadIds)
        return this.entities.run(workspaceId, (api) => this.scanForLeads(api, wanted, undefined, LEAD_SCAN_PAGES))
    }

    /** The conversation a turn answers, with the agent that speaks in it, or a refusal when it or its agent does not exist. */
    async turnOf(
        workspaceId: string,
        conversationId: string,
    ): Promise<Outcome<ChatTurnConversation, ChatRecordsErrorCode>> {
        const facts = await this.entities.run(workspaceId, (api) => this.readOne(api, byId(conversationId)))
        const agent = facts === null ? null : await this.agents.turnFactsOf(facts.agentId)
        if (facts === null || agent === null) return refused(ChatRecordsErrorCode.NotFound)
        const frontId = facts.data.frontAgentId
        const front = frontId === null || frontId === facts.agentId ? null : await this.agents.turnFactsOf(frontId)
        const installation = await this.installations.ofAgent(workspaceId, facts.agentId)
        return ok({
            ...targetOf(facts),
            leadId: facts.leadId,
            handledBy: facts.data.handledBy,
            visitorName: refOf(facts).visitorName,
            installationId: installation?.id ?? null,
            agent,
            speaksAs: front?.name ?? null,
        })
    }

    /** The connector party the conversation remembers, or null while it remembers none. */
    partyOf(workspaceId: string, conversationId: string): Promise<OptionalChatConversationParty> {
        return this.entities.run(workspaceId, async (api) => {
            return partyOfFacts(await this.readOne(api, byId(conversationId)))
        })
    }

    /** Remembers the party a connector answered for the conversation's customer; the latest answer wins. */
    rememberParty(workspaceId: string, conversationId: string, party: ChatConversationParty): Promise<void> {
        return this.entities.run(workspaceId, (api) =>
            this.change(
                api,
                conversationId,
                () => ({ connectorPartyId: party.partyId, connectorPartyName: party.name }),
                WRITE_ATTEMPTS,
            ),
        )
    }

    /** The first conversation a condition selects, read with its lead link, or null. */
    private async readOne(api: EntitiesApi, where: FilterExpr): Promise<ConversationFacts | null> {
        const page = await api.list(oneConversationQuery(where))
        const [found] = page.rows
        return found === undefined ? null : factsOf(found)
    }

    /** One page of the newest conversations from `after`, with the ones tied to a wanted lead, then the next pages while pages are left. */
    private async scanForLeads(
        api: EntitiesApi,
        wanted: ReadonlySet<string>,
        after: string | undefined,
        pagesLeft: number,
    ): Promise<ReadonlyArray<ChatHumanConversation>> {
        const query = conversationQuery(q.ne("channel", ""), PAGE_MAX)
        const page = await api.list(after === undefined ? query : { ...query, page: { size: PAGE_MAX, after } })
        const tied = page.rows
            .flatMap((found) => factsOf(found) ?? [])
            .filter((facts) => facts.leadId !== null && wanted.has(facts.leadId))
            .map(humanOf)
        if (page.next === null || pagesLeft <= 1) return tied
        return [...tied, ...(await this.scanForLeads(api, wanted, page.next, pagesLeft - 1))]
    }

    /** Writes the values `build` derives from the conversation as it is now; a writer that moved it first makes the write start again from what that writer wrote. */
    private async change(
        api: EntitiesApi,
        id: string,
        build: (facts: ConversationFacts) => Change,
        attemptsLeft: number,
    ): Promise<void> {
        const facts = await this.readOne(api, byId(id))
        if (facts === null) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotFound })
        const written = await api.update(CONVERSATION_ENTITY, id, facts.version, build(facts))
        if (written.ok) return
        if (written.reason !== "stale" || attemptsLeft <= 1)
            throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
        await this.change(api, id, build, attemptsLeft - 1)
    }
}

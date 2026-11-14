import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { reportFactsKind, type MessageFact } from "@nivo-lite/agent-sdk/team-chat"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { PublicApiLogEvent } from "./public-api.log-events"

/** Why a public-API message was held: the caller asked for an approval, or it waited longer than its auto-send window. */
export type HeldReason = "approval_asked" | "stale"

/** A public-API message that was held, and the agent whose conversation it was meant for. */
export interface HeldMessage {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that speaks in the conversation (the API key's agent owns it): the founder hears of it in that agent's direct room. */
    readonly agentId: string
    /** The customer conversation the message was meant for. */
    readonly conversationId: string
    /** The ledger request of the message: the report is told once per request. */
    readonly requestId: string
    /** The exact text the caller sent. */
    readonly text: string
    /** Why it was held. */
    readonly reason: HeldReason
}

/** The words of each reason, as the message bundle holds them. */
const REASON_KEYS: Readonly<Record<HeldReason, string>> = {
    approval_asked: "publicApi.held.reason.approval_asked",
    stale: "publicApi.held.reason.stale",
}

/** The language of the report: an API request names none, and the workspace has no language setting. */
const LOCALE = "vi"

@Injectable()
/**
 * Tells the founder about a public-API message that was HELD (no approval road takes a message outside a run): an unhandled case on
 * /chat, in the direct room of the agent whose conversation it was meant for, with the exact text and why, ONCE per request, so a person
 * can answer the customer from the workbench. The words are the engine's own, from the message bundles; the customer is told nothing.
 * A team chat that cannot take the report is logged, never thrown: the hold itself is already recorded.
 */
export class PublicMessageHoldsService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Posts the one report of a held message. */
    async report(held: HeldMessage): Promise<void> {
        const meta = { workspaceId: held.workspaceId, requestId: held.requestId }
        const post = this.nodes.optionalExecutorOf(TOOL.teamMessagePost)
        if (post === undefined) {
            this.logger.warn(PublicApiLogEvent.HeldReportSkipped, meta)
            return
        }
        const say = (key: string): string => this.catalog.get(key, {}, LOCALE)
        const facts: ReadonlyArray<MessageFact> = [
            { name: say("teamChat.fact.why"), value: say(REASON_KEYS[held.reason]), technical: false },
            { name: say("publicApi.held.fact.text"), value: held.text, technical: false },
            { name: say("teamChat.fact.conversation"), value: held.conversationId, technical: true },
        ]
        const turn: NodeTurn = {
            turnId: held.requestId,
            workspaceId: held.workspaceId,
            agentId: held.agentId,
            subject: null,
            conversationId: null,
            locale: LOCALE,
            origin: "system",
        }
        const key = `api-message-held:${held.requestId}`
        try {
            await post.execute(
                turn,
                {
                    kind: reportFactsKind.id,
                    title: say("publicApi.held.title"),
                    text: say("publicApi.held.sentence"),
                    facts: facts.map((fact) => ({ ...fact })),
                    audience: "founder",
                },
                { key, dedupeKey: key },
            )
        } catch (cause) {
            this.logger.error(PublicApiLogEvent.HeldReportSkipped, cause, meta)
        }
    }
}

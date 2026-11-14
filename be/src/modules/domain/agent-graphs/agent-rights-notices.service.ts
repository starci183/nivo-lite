import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { reportFactsKind, type MessageFact } from "@nivo-lite/agent-sdk/team-chat"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

/** The effect a notice reaches the team through. */
const TEAM_POST: string = TOOL.teamMessagePost

/** The language the engine speaks when nobody's language is known: no person is in the step that failed. */
const LOCALE = "vi"

/** A published version whose follow-up (the adoption as a workflow version, or the naming of its grant rows) was given up. */
export interface UnfinishedPublish {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent whose graph was published. */
    readonly agentId: string
    /** The primary workflow the rows belong to, or null. */
    readonly workflowId: string | null
    /** The agent graph version that was published, or null when the caller names none. */
    readonly graphVersionId: string | null
}

@Injectable()
/**
 * What the engine tells the founder, in the agent's private chat with them, when a publish of the agent's own graph committed (the
 * version and the rights the owner agreed stand) but what follows it was given up after its retry: the primary workflow was not
 * brought up to the version, or its grant rows were not named it. Nothing is asked of a customer and nothing is taken back: the
 * engine says its own static words with the plain facts, once per published version. A chat that cannot take it is logged.
 */
export class AgentRightsNoticesService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Tells the founder, once per published version, that the follow-up of a publish was given up; never throws. */
    async publishUnfinished(publish: UnfinishedPublish): Promise<void> {
        const { workspaceId, agentId, workflowId, graphVersionId } = publish
        const post = this.nodes.optionalExecutorOf(TEAM_POST)
        const key = `rights-stamp:${agentId}:${graphVersionId ?? workflowId ?? "unnamed"}`
        if (post === undefined) {
            this.logger.warn(AgentGraphsLogEvent.RightsNoticeSkipped, { agentId, workflowId })
            return
        }
        const technical = (label: string, value: string | null): ReadonlyArray<MessageFact> =>
            value === null ? [] : [{ name: label, value, technical: true }]
        const turn: NodeTurn = {
            turnId: key,
            workspaceId,
            agentId,
            subject: null,
            conversationId: null,
            locale: LOCALE,
            origin: "system",
        }
        try {
            await post.execute(
                turn,
                {
                    kind: reportFactsKind.id,
                    title: this.catalog.get("agentGraphs.publishUnfinished.title", {}, LOCALE),
                    text: this.catalog.get("agentGraphs.publishUnfinished.sentence", {}, LOCALE),
                    facts: [...technical("workflow", workflowId), ...technical("version", graphVersionId)],
                    audience: "founder",
                },
                { key, dedupeKey: key },
            )
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.RightsNoticeSkipped, cause, { agentId, workflowId })
        }
    }
}

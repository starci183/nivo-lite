import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { KnowledgePassages, KnowledgeSearch, ToolContext } from "@modules/domain/agent-tools"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { viewOf } from "./knowledge-view.policy"

/** The module a conversation answers in when its agent cannot be read. */
const DEFAULT_MODULE = "chatbot"
/** How many passages a tool search returns. */
const TOOL_LIMITS = { facts: 6, passages: 6, budget: 3000 }

@Injectable()
/**
 * The `knowledge.search` tool OpenClaw calls during a customer turn: the PUBLIC knowledge of the conversation's own agent and instance
 * (the knowledge shared by every instance plus what is kept for that branch), never another tenant's and never an internal document.
 */
export class KnowledgeSearchToolService implements KnowledgeSearch {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly recall: KnowledgeRecallService,
    ) {}

    /** The passages and citations for a query, customer audience only. */
    async search(ctx: ToolContext, query: string): Promise<KnowledgePassages> {
        const turn = await this.conversations.turnOf(ctx.conversationId)
        const own = turn.kind === "ok" && turn.value.workspaceId === ctx.workspaceId ? turn.value : null
        const view = viewOf({
            workspaceId: ctx.workspaceId,
            module: own?.agent.module ?? DEFAULT_MODULE,
            audience: "customer",
            installationId: own?.installationId ?? null,
        })
        const found = await this.recall.recall(view, query, TOOL_LIMITS)
        return {
            passages: found.brief,
            citations: found.passages.map((passage) => ({ title: passage.title, topic: passage.topic ?? "" })),
        }
    }
}

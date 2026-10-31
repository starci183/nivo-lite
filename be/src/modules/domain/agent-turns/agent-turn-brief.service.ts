import { Injectable, Optional } from "@nestjs/common"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectAgentGraphBrief } from "./agent-turns.decorators"
import { blockOf, intentLineOf } from "./internal-turn-prompt.policy"
import type { AgentGraphBrief } from "./agent-turns.port"

@Injectable()
/**
 * The intents the action graph lets an agent ask for, as a block of a prompt. With no graph bound, or a graph that allows none, the block
 * is empty and the turn runs exactly as it did before there was a graph. It lists the intents only: the boundaries are applied by the
 * back end, so they earn no tokens.
 */
export class AgentTurnBriefService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() @InjectAgentGraphBrief() private readonly graph?: AgentGraphBrief,
    ) {}

    /** The block of intents of the agent; an empty text when there is none. */
    async intentsBlock(workspaceId: string, agentId: string, locale: Locale): Promise<string> {
        if (this.graph === undefined) return ""
        const intents = await this.graph.intentsOf(workspaceId, agentId)
        return blockOf(this.catalog.get("agentTurns.intentsTitle", {}, locale), intents.map(intentLineOf))
    }
}

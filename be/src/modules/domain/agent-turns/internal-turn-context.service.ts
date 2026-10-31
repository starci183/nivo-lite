import { Injectable } from "@nestjs/common"
import { AgentGoalsService, AgentTasksService } from "@modules/domain/agent-work"
import { authorityBrief } from "@modules/domain/ai-tasks"
import { AuthorityService } from "@modules/domain/authority"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentTurnBriefService } from "./agent-turn-brief.service"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import { blockOf, dataOf, goalLineOf, joinParts, taskLineOf } from "./internal-turn-prompt.policy"
import type { InternalTurnInput } from "./agent-turns.contracts"

@Injectable()
/**
 * The message of a tag or background turn: the owner's authority, the agent's own goals and open tasks, the intents its graph allows,
 * the reply contract, and last the words of the wake under a label that says they are data. The agent's persona, rules and knowledge
 * are in its synced workspace, so they are not sent again. A part that cannot be read is left out, never the turn.
 */
export class InternalTurnContextService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly authority: AuthorityService,
        private readonly goals: AgentGoalsService,
        private readonly tasks: AgentTasksService,
        private readonly brief: AgentTurnBriefService,
    ) {}

    /** The whole message of the turn. */
    async messageOf(input: InternalTurnInput): Promise<string> {
        const { workspaceId, agentId, locale } = input
        const [authority, goals, tasks, intents] = await Promise.all([
            this.authority
                .load({ workspaceId })
                .then(authorityBrief)
                .catch((cause: unknown) => this.skip(cause, agentId, "authority")),
            this.goals
                .alive(agentId)
                .then((rows) => blockOf(this.catalog.get("agentTurns.goalsTitle", {}, locale), rows.map(goalLineOf)))
                .catch((cause: unknown) => this.skip(cause, agentId, "goals")),
            this.tasks
                .alive(agentId)
                .then((rows) => blockOf(this.catalog.get("agentTurns.tasksTitle", {}, locale), rows.map(taskLineOf)))
                .catch((cause: unknown) => this.skip(cause, agentId, "tasks")),
            this.brief
                .intentsBlock(workspaceId, agentId, locale)
                .catch((cause: unknown) => this.skip(cause, agentId, "intents")),
        ])
        const wake = this.catalog.get(
            "agentTurns.wakeBlock",
            { source: input.source, text: dataOf(input.text) },
            locale,
        )
        return joinParts([
            authority,
            goals,
            tasks,
            intents,
            this.catalog.get("bundle.internalContract", {}, locale),
            wake,
        ])
    }

    private skip(cause: unknown, agentId: string, part: string): string {
        this.logger.error(AgentTurnsLogEvent.ContextPartFailed, cause, { agentId, part })
        return ""
    }
}

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
import { IntentPipelineService } from "./intent-pipeline.service"
import { IntentTurnService } from "./intent-turn.service"
import { wakeScopeOf } from "./intent-wake.policy"
import { blockOf, dataOf, goalLineOf, joinParts, taskLineOf } from "./internal-turn-prompt.policy"
import type { IntentInputPart } from "@modules/domain/intent-contracts"
import type { InternalTurnInput } from "./agent-turns.contracts"

/** The three blocks both roads of a tag or background turn share. */
interface InternalBlocks {
    /** The owner's authority. */
    readonly authority: string
    /** The agent's goals. */
    readonly goals: string
    /** The agent's open tasks. */
    readonly tasks: string
}

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
        private readonly intents: IntentTurnService,
        private readonly pipeline: IntentPipelineService,
    ) {}

    /** The whole message of the turn. */
    async messageOf(input: InternalTurnInput): Promise<string> {
        const intended = await this.promptOf(input)
        if (intended !== null) return intended
        const { workspaceId, agentId, locale } = input
        const [{ authority, goals, tasks }, intents] = await Promise.all([
            this.blocksOf(input),
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

    /**
     * The input of a turn on the contract pipeline: the same authority, goals and open tasks, and the words of the wake, each as a part of
     * data. The intents and the reply contract are not here: the contracts the turn is offered tell both.
     */
    async partsOf(input: InternalTurnInput): Promise<ReadonlyArray<IntentInputPart>> {
        const { authority, goals, tasks } = await this.blocksOf(input)
        return [
            { kind: "authority", text: authority },
            { kind: "goals", text: goals },
            { kind: "tasks", text: tasks },
            { kind: input.source === "tag" ? "tag_message" : "wake", text: dataOf(input.text) },
        ].filter((part) => part.text !== "")
    }

    /**
     * The contract prompt of a turn the published graph holds contracts for, with its run opened; null when the turn stays on the message
     * above, which is every background turn and every tag the graph holds no contract for.
     */
    private async promptOf(input: InternalTurnInput): Promise<string | null> {
        const { wake, agentName, locale } = input
        if (wake === undefined || agentName === undefined) return null
        const plan = await this.intents.planFor(wakeScopeOf(wake))
        if (plan === null) return null
        const identity = this.catalog.get("agentTurns.identity", { name: agentName }, locale)
        const planned = this.intents.planOf(plan, identity, await this.partsOf(input), locale)
        await this.pipeline.open(wake, planned)
        return planned.prompt
    }

    private async blocksOf(input: InternalTurnInput): Promise<InternalBlocks> {
        const { workspaceId, agentId, locale } = input
        const [authority, goals, tasks] = await Promise.all([
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
        ])
        return { authority, goals, tasks }
    }

    private skip(cause: unknown, agentId: string, part: string): string {
        this.logger.error(AgentTurnsLogEvent.ContextPartFailed, cause, { agentId, part })
        return ""
    }
}

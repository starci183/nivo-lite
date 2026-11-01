import { Injectable } from "@nestjs/common"
import { KnowledgeRecallService, viewOf } from "@modules/domain/agent-knowledge"
import { authorityBrief } from "@modules/domain/ai-tasks"
import { AuthorityService } from "@modules/domain/authority"
import type { CustomerTurn } from "@modules/domain/conversations"
import { HiringPublicService } from "@modules/domain/hiring"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import type { IntentContext } from "./customer-intent.contracts"
import { intentContextOf } from "./customer-intent.policy"
import { recallSourcesOf } from "./knowledge-sources.policy"
import { TurnModulesService } from "./turn-modules.service"

@Injectable()
/**
 * What a customer turn on the contract pipeline reads, as data: the owner's instructions for the agent, the authority the owner granted,
 * the open jobs and the booking and loyalty facts, the conversation so far and the customer's latest message. The knowledge recalled for
 * the question stays public only, and its text reaches the agent through `knowledge.search`; the turn keeps its sources for the cards.
 * Who the agent is stays one trusted line. A block that cannot be read is left out, never the turn.
 */
export class CustomerIntentContextService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly authority: AuthorityService,
        private readonly recall: KnowledgeRecallService,
        private readonly hiring: HiringPublicService,
        private readonly modules: TurnModulesService,
    ) {}

    /** The identity, the input in reading order and the knowledge sources of the turn. */
    async contextOf(turn: CustomerTurn): Promise<IntentContext> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        const view = viewOf({
            workspaceId,
            module: conversation.agent.module,
            audience: "customer",
            installationId: conversation.installationId,
        })
        const authority = this.authority
            .load({ workspaceId })
            .then(authorityBrief)
            .catch((cause: unknown) => this.skip(cause, workspaceId, "authority"))
        const jobs = this.hiring
            .chatBrief(workspaceId)
            .catch((cause: unknown) => this.skip(cause, workspaceId, "hiring"))
        const modules = this.modules
            .briefs(conversation)
            .catch((cause: unknown): ReadonlyArray<string> => [this.skip(cause, workspaceId, "modules")])
        const recalled = await this.recall.recall(view, turn.body)
        const { identity, input } = intentContextOf(turn, await authority, [await jobs, ...(await modules)])
        return { identity, input, sources: recallSourcesOf(recalled.facts, recalled.passages) }
    }

    private skip(cause: unknown, workspaceId: string, part: string): string {
        this.logger.error(CustomerTurnsLogEvent.ContextPartFailed, cause, { workspaceId, part })
        return ""
    }
}

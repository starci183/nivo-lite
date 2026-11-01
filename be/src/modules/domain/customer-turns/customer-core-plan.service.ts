import { Injectable } from "@nestjs/common"
import { AgentTurnBriefService, RuntimeAgentService } from "@modules/domain/agent-turns"
import { replyTimeoutSec } from "@modules/domain/agents"
import { ChatFileReadsService } from "@modules/domain/chat-files"
import type { CustomerTurn } from "@modules/domain/conversations"
import { threadKeyFor } from "@modules/integrations/openclaw"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { fileTurnOf } from "./customer-turn.policy"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { turnMessageOf } from "./turn-prompt.policy"
import { TurnToolAccessService } from "./turn-tool-access.service"
import type { TurnPlanAnswer } from "./customer-turns.contracts"

/** The language the fixed lines of the context are written in. */
const LOCALE = "vi"
/** Why a turn falls back when its context could not be built. */
const UNAVAILABLE = "openclaw_unavailable"
/** What separates the parts of the system text. */
const BLOCK_SEPARATOR = "\n\n"

@Injectable()
/**
 * The plan of a customer turn on the core road. It makes the installation gate and builds the context the legacy road builds (persona,
 * authority, the PUBLIC knowledge recalled for the question, open jobs, the reply contract), adds the intents the agent's action graph
 * allows, and leaves the token block out: the agent reaches its tools through the bridge, which finds the turn by its session. The quota
 * and the breaker are the executor's gates, not these. What the turn read is kept for the cards its tool calls open, until `end`.
 */
export class CustomerCorePlanService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly runtime: CustomerTurnRuntimeService,
        private readonly agents: RuntimeAgentService,
        private readonly brief: AgentTurnBriefService,
        private readonly access: TurnToolAccessService,
        private readonly fileReads: ChatFileReadsService,
    ) {}

    /** The plan of the turn, or the reason it cannot run. */
    async planOf(turn: CustomerTurn): Promise<TurnPlanAnswer> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        const installation = await this.runtime.installationOf(workspaceId, conversation.agent.id)
        if (typeof installation === "string") return installation
        try {
            const runtimeAgentId = await this.agents.agentFor(workspaceId, conversation.agent.module, installation)
            const system = await this.runtime.systemOf(turn)
            this.access.keep(turn, system.sources)
            const intents = await this.brief
                .intentsBlock(workspaceId, conversation.agent.id, LOCALE)
                .catch((cause: unknown) => this.skip(cause, workspaceId))
            return {
                module: conversation.agent.module,
                runtimeAgentId,
                threadKey: threadKeyFor(runtimeAgentId, conversation.id),
                message: turnMessageOf(
                    [system.text, intents].filter((part) => part !== "").join(BLOCK_SEPARATOR),
                    turn.transcript,
                    turn.body,
                ),
                attachments: await this.fileReads.attachmentsOf(fileTurnOf(turn)),
                timeoutMs: replyTimeoutSec(installation?.settings ?? null) * 1000,
            }
        } catch (cause) {
            this.logger.error(CustomerTurnsLogEvent.TurnFailed, cause, { conversationId: conversation.id })
            return UNAVAILABLE
        }
    }

    /** Ends the tools of a turn: what it kept for its cards is forgotten. */
    end(turn: CustomerTurn): void {
        this.access.close(turn)
    }

    private skip(cause: unknown, workspaceId: string): string {
        this.logger.error(CustomerTurnsLogEvent.ContextPartFailed, cause, { workspaceId, part: "intents" })
        return ""
    }
}

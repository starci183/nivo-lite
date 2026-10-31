import { Injectable } from "@nestjs/common"
import { AgentTasksService, AgentTurnsService } from "@modules/domain/agent-work"
import type { AgentTaskOp, AgentTurnView } from "@modules/domain/agent-work"
import { ModuleCatalogService, WorkEngineService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { proposalTextOf } from "./agent-turn.policy"
import { AgentWriteRightService } from "./agent-write-right.service"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import { readInternalProposal } from "./internal-contract.policy"
import type {
    InternalAction,
    InternalActionResult,
    InternalSettled,
    InternalSettleInput,
} from "./agent-turns.contracts"

/** Why an action is dropped: the registry has no such action. */
const UNKNOWN_ACTION = "unknown_action"
/** Why an action is dropped: it belongs to another module than the agent's. */
const OUTSIDE_MODULE = "outside_module"

@Injectable()
/**
 * Applies what a tag or background turn proposed, and nothing more. A task change is written under the agent's own key, so applying the
 * same proposal twice changes nothing the second time. An action is a request and never an effect: it goes to the work engine with the
 * agent as actor and the key `agentturn:<wakeId>:<index>`, so the authority gate decides, and a turn whose person may not write (a staff tag, a background turn) always asks one. An
 * unknown action, or one outside the agent's module, is dropped and audited. A worker that lost its lease runs nothing.
 */
export class InternalProposalSettlerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly turns: AgentTurnsService,
        private readonly tasks: AgentTasksService,
        private readonly engine: WorkEngineService,
        private readonly catalog: ModuleCatalogService,
        private readonly events: EventsService,
        private readonly right: AgentWriteRightService,
    ) {}

    /**
     * Settles the proposal the executor stored for the turn: the model's text is read here, so what is not a proposal is a plain reply.
     * `stale` means the lease had moved on and nothing was written or requested.
     */
    async settle(turn: AgentTurnView, stored: unknown, input: InternalSettleInput): Promise<InternalSettled> {
        if (!(await this.turns.touch(turn))) return { kind: "stale" }
        const proposal = readInternalProposal(proposalTextOf(stored))
        const ops = proposal.tasks.map((task): AgentTaskOp => ({ ...task, originWakeId: turn.wakeId }))
        await this.tasks.apply(turn.workspaceId, turn.agentId, ops)
        const actions: Array<InternalActionResult> = []
        await eachInOrder(proposal.actions, async (action, index) => {
            actions.push(await this.request(turn, action, index, input))
        })
        return {
            kind: "settled",
            reply: proposal.reply,
            needsHuman: proposal.needsHuman,
            reason: proposal.reason,
            tasks: ops.length,
            actions,
        }
    }

    private async request(
        turn: AgentTurnView,
        action: InternalAction,
        index: number,
        input: InternalSettleInput,
    ): Promise<InternalActionResult> {
        const entry = await this.catalog.actionOf(action.action)
        if (entry === null) return this.drop(turn, action, index, input, UNKNOWN_ACTION)
        if (entry.moduleKey !== input.module) return this.drop(turn, action, index, input, OUTSIDE_MODULE)
        const mayWrite = await this.right.mayWrite(turn.source, turn.context.authorUserId ?? null, turn.workspaceId)
        const item = await this.engine.runWork(
            { workspaceId: turn.workspaceId, actor: input.actorName, locale: input.locale },
            {
                action: action.action,
                subject_type: action.subject?.type ?? (action.leadId === null ? "inbound" : "lead"),
                subject_id: action.subject?.id ?? null,
                lead_id: action.leadId,
                dedupeKey: `agentturn:${turn.wakeId}:${String(index)}`,
                preset: true,
                forceAsk: mayWrite ? undefined : "over_authority",
                installationId: input.installationId,
                seed: { summary: action.summary, fields: action.fields },
                origin: { turnId: turn.turnId, wakeId: turn.wakeId },
            },
        )
        return { index, action: action.action, outcome: "requested", workItemId: item.id }
    }

    private async drop(
        turn: AgentTurnView,
        action: InternalAction,
        index: number,
        input: InternalSettleInput,
        reason: string,
    ): Promise<InternalActionResult> {
        this.logger.warn(AgentTurnsLogEvent.ActionDropped, {
            agentId: turn.agentId,
            wakeId: turn.wakeId,
            index,
            reason,
        })
        await this.events.record({
            workspaceId: turn.workspaceId,
            kind: "agent.action_dropped",
            actor: input.actorName,
            summary: `Action ${action.action} was dropped: ${reason}`,
            evidence: `agentturn:${turn.wakeId}:${String(index)}`,
        })
        return { index, action: action.action, outcome: "dropped", reason }
    }
}

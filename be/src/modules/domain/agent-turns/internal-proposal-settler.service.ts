import { Injectable } from "@nestjs/common"
import { AgentTasksService, AgentTurnsService } from "@modules/domain/agent-work"
import type { AgentTaskOp, AgentTurnView } from "@modules/domain/agent-work"
import { ModuleCatalogService, WorkEngineService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { IntentTrace } from "@modules/domain/intent-contracts"
import { eachInOrder } from "@modules/platform/primitives"
import { proposalTextOf } from "./agent-turn.policy"
import { tagDoorResultSchema } from "./intent-step.schema"
import { INTENT_STEP_KIND } from "./intent-turn.policy"
import { IntentPipelineService } from "./intent-pipeline.service"
import { IntentTurnService } from "./intent-turn.service"
import { internalWakeOf, wakeScopeOf } from "./intent-wake.policy"
import { AgentWriteRightService } from "./agent-write-right.service"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import { readInternalProposal } from "./internal-contract.policy"
import type {
    InternalAction,
    InternalActionResult,
    IntentDoorResult,
    InternalSettled,
    InternalSettleInput,
    InternalWakeRef,
    SettledProposal,
} from "./agent-turns.contracts"

/** A signal that never aborts, for a settle that is not driven by a drain. */
const NO_ABORT = new AbortController().signal

/** Why an action is dropped: the registry has no such action. */
const UNKNOWN_ACTION = "unknown_action"
/** Why an action is dropped: it belongs to another module than the agent's. */
const OUTSIDE_MODULE = "outside_module"

@Injectable()
/**
 * Applies what a tag or background turn proposed, and nothing more. A task change is written under the agent's own key, so applying the
 * same proposal twice changes nothing the second time. An action is a request and never an effect: it goes to the work engine with the
 * agent as actor and the key `agentturn:<wakeId>:<index>`, so the authority gate decides, and a turn whose person may not write (a staff tag, a background turn) always asks one. An
 * unknown action, one outside the agent's module, or one whose ids are no record's, is dropped and audited, and the reply still leaves. A worker that lost its lease runs nothing.
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
        private readonly intents: IntentTurnService,
        private readonly pipeline: IntentPipelineService,
    ) {}

    /**
     * Settles the proposal the executor stored for the turn: the model's text is read here, so what is not a proposal is a plain reply.
     * `stale` means the lease had moved on and nothing was written or requested.
     */
    async settle(
        turn: AgentTurnView,
        stored: unknown,
        input: InternalSettleInput,
        signal: AbortSignal = NO_ABORT,
    ): Promise<InternalSettled> {
        if (!(await this.live(turn))) return { kind: "stale" }
        const text = proposalTextOf(stored)
        const plan = await this.intents.planFor(wakeScopeOf(turn))
        if (plan === null) return this.apply(internalWakeOf(turn), text, input)
        const read = await this.pipeline.read(turn, plan, text, signal)
        const done = await this.pipeline.door(turn, INTENT_STEP_KIND.tagDoor, read, signal, { settle: input })
        return this.settledOf(done, read.trace)
    }

    /** True while this worker still holds the lease of the turn. */
    live(turn: AgentTurnView): Promise<boolean> {
        return this.turns.touch(turn)
    }

    /** Applies the text of a proposal for a wake that is named by its ids alone, so a step can do it from its row; the caller holds the lease. */
    async apply(turn: InternalWakeRef, text: string, input: InternalSettleInput): Promise<SettledProposal> {
        const proposal = readInternalProposal(text)
        const ops = proposal.tasks.map((task): AgentTaskOp => ({ ...task, originWakeId: turn.wakeId }))
        await this.tasks.apply(turn.workspaceId, turn.agentId, ops)
        const actions: Array<InternalActionResult> = []
        await eachInOrder(proposal.actions, async (action, index) => {
            actions.push(await this.request(turn, action, index, input))
        })
        await eachInOrder(proposal.refused, async (refused, index) => {
            actions.push(await this.drop(turn, refused.action, proposal.actions.length + index, input, refused.reason))
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

    /** What the tag door did, as the settler answers it: a split settles nothing, every other reading was applied through the one door. */
    private settledOf(done: IntentDoorResult, trace: IntentTrace): SettledProposal {
        const result = tagDoorResultSchema.safeParse(done)
        const traced = { intent: trace }
        if (!result.success || result.data.split) {
            return { kind: "settled", reply: "", needsHuman: false, reason: "", tasks: 0, actions: [], traced }
        }
        return { kind: "settled", ...result.data.settled, traced }
    }

    private async request(
        turn: InternalWakeRef,
        action: InternalAction,
        index: number,
        input: InternalSettleInput,
    ): Promise<InternalActionResult> {
        const entry = await this.catalog.actionOf(action.action)
        if (entry === null) return this.drop(turn, action.action, index, input, UNKNOWN_ACTION)
        if (entry.moduleKey !== input.module) return this.drop(turn, action.action, index, input, OUTSIDE_MODULE)
        const mayWrite = await this.right.mayWrite(turn.source, turn.authorUserId, turn.workspaceId)
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
        turn: InternalWakeRef,
        action: string,
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
            summary: `Action ${action} was dropped: ${reason}`,
            evidence: `agentturn:${turn.wakeId}:${String(index)}`,
        })
        return { index, action, outcome: "dropped", reason }
    }
}

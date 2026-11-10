import { Injectable, Optional } from "@nestjs/common"
import { TOOL } from "@nivo-lite/blocks-core"
import type { EntityManager } from "typeorm"
import { EntityEngineService, EntityMutationService, type ScopedTx } from "@modules/domain/entity-engine"
import { AgentWakeService, tagPayloadOf, type AgentTurnView, type AgentWakeContext } from "@modules/domain/agent-work"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { CALL_WORKFLOW_STEP, LATEST_VERSION, WORKFLOW_CALL_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { OUTCOME_STEP } from "@nivo-lite/agent-sdk/node"
import type { StepView } from "@modules/domain/agent-runs"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { AgentGraphFreezeGateService } from "./agent-graph-freeze-gate.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

const HOLD = "agent.conversation-hold"

/** Binds the cursor of every list of this store: one bounded page. */
const LIST_SCOPE = "agent-conversation-holds"

/** How long a hold stands with no turn of its agent: a consult left open for a day no longer keeps the customer from the front door. */
/** The effect that speaks to the customer: a step that may run it needs the right to speak in the conversation. */
const CHANNEL_SEND = TOOL.customerMessageSend

export const HOLD_TTL_MS: number = 24 * 60 * 60_000

/** The source of a customer's wake: the only wake a hold redirects. */
const CUSTOMER = "customer"

/** The steps that end a holding workflow's turn for good: an outcome, or a hand-off to another workflow or agent. */
const ENDING_STEPS: ReadonlySet<string> = new Set([OUTCOME_STEP, CALL_WORKFLOW_STEP, "core.handoff"])

/** The mark of a customer's wake sent on to the agent that holds the conversation. */
const HELD_MARK = "~held-by-"

/** The agent that keeps a conversation, and since when. */
export interface ConversationHold {
    /** The record. */
    readonly id: string
    /** The agent that keeps it. */
    readonly agentId: string
    /** The run that last kept it. */
    readonly runId: string
    /** When it was last kept. */
    readonly heldAt: Date
    /** The workflow of the run that keeps it, or null for the agent's own graph. */
    readonly workflowId: string | null
}

/** A hold, or null when nobody keeps the conversation. */
export type OptionalConversationHold = ConversationHold | null

/** What a keep of a conversation writes: who keeps it, from which run and workflow. */
export interface HoldKeep {
    /** The conversation. */
    readonly conversationId: string
    /** The agent that keeps it. */
    readonly agentId: string
    /** Its run. */
    readonly runId: string
    /** The workflow of the run, or null for the agent's own graph. */
    readonly workflowId: string | null
}

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const holdOf = (row: RecordRow): OptionalConversationHold => {
    const agentId = textOf(row.data.agentId)
    const runId = textOf(row.data.runId)
    const heldAt = textOf(row.data.heldAt)
    return agentId === null || runId === null || heldAt === null
        ? null
        : { id: row.id, agentId, runId, heldAt: new Date(heldAt), workflowId: textOf(row.data.workflowId) }
}

@Injectable()
/**
 * The conversations a workflow keeps between turns, as an engine rule: a workflow that declares `entry.holdsConversation` (the Sales
 * consult) keeps its customer's conversation when a turn of it ends without an outcome or a hand-off, and lets it go when one does. While
 * it keeps it, a customer's line that reaches another agent (the front door, where every channel message lands) is sent on to the
 * keeper, so one voice answers the whole consult and no graph needs an if for it. A hold untouched for a day lapses.
 */
export class AgentGraphConversationHoldsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        private readonly wakes: AgentWakeService,
        private readonly graphs: AgentGraphsService,
        @Optional() private readonly workflows?: AgentWorkflowRunsService,
        @Optional() private readonly conversations?: ChatConversationsService,
        @Optional() private readonly nodes?: GraphNodeRegistryService,
        @Optional() private readonly freezes?: AgentGraphFreezeGateService,
    ) {}

    /**
     * After the last step of a turn in a customer's conversation: true when the turn's workflow holds the conversation and the turn ended
     * without an outcome or a hand-off, so its agent keeps the conversation (the caller does not release it); false otherwise, after
     * letting go of a hold the workflow's outcome or hand-off ended.
     */
    async keptAfter(step: StepView, input: GraphNodeStepInput, conversationId: string): Promise<boolean> {
        const { flow } = await this.graphs.documentOf(step.workspaceId, step.agentId, input.versionId)
        if (flow?.entry?.holdsConversation !== true) return false
        const node = flow.nodes.find((candidate) => candidate.key === input.nodeKey)
        if (node !== undefined && ENDING_STEPS.has(node.step)) {
            await this.free(step.workspaceId, conversationId, step.agentId)
            return false
        }
        const workflowId = typeof input.workflowId === "string" ? input.workflowId : null
        await this.keep(step.workspaceId, { conversationId, agentId: step.agentId, runId: step.runId, workflowId })
        return true
    }

    /**
     * Before a step of a workflow that holds the conversation speaks in it (the node step calls this for every node, before it runs): the right to speak is the run's. It is ITS agent's when no
     * other agent keeps the conversation, whatever moved it since (the front door met the customer again, the run was frozen and the
     * owner retries it, the run resumes after a wait): the hold is renewed for this run and the conversation follows the agent. A
     * conversation another agent's workflow keeps is left alone (that one answers), and so is a workflow that holds nothing. Engine rule,
     * so no graph and no retry path needs to move the speaker itself.
     */
    async speakFor(step: StepView, input: GraphNodeStepInput, nodeStep: string): Promise<void> {
        // Only a node that may send to the customer (it runs `channel.send`) needs the right to speak.
        const effects = this.nodes?.installed().nodes.get(nodeStep)?.effects ?? []
        if (!effects.includes(CHANNEL_SEND)) return
        const conversationId = textOf(Reflect.get(input.trigger, "conversationId"))
        if (conversationId === null) return
        const { flow } = await this.graphs.documentOf(step.workspaceId, step.agentId, input.versionId)
        if (flow?.entry?.holdsConversation !== true) return
        const hold = await this.holderOf(step.workspaceId, conversationId)
        if (hold !== null && hold.agentId !== step.agentId) return
        const workflowId = typeof input.workflowId === "string" ? input.workflowId : null
        await this.keep(step.workspaceId, { conversationId, agentId: step.agentId, runId: step.runId, workflowId })
        await this.conversations?.follow(step.workspaceId, conversationId, step.agentId)
    }

    /** The agent that keeps the conversation now, or null when nobody does (or the hold lapsed). */
    holderOf(workspaceId: string, conversationId: string): Promise<OptionalConversationHold> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const hold = await this.byConversation(tx, conversationId)
            return hold !== null && this.clock.now().getTime() - hold.heldAt.getTime() < HOLD_TTL_MS ? hold : null
        })
    }

    /** Keeps the conversation for the agent of a turn that ended without an outcome or a hand-off. */
    async keep(workspaceId: string, keep: HoldKeep): Promise<void> {
        const values = { ...keep, heldAt: this.clock.now().toISOString() }
        await this.engine.scoped(workspaceId, (tx) =>
            this.mutations.mutate(tx, { op: "upsert", entity: HOLD, on: "conversation_key", values }, "job"),
        )
    }

    /** Lets the conversation go when the agent keeps it: its workflow reached an outcome or handed off. */
    async free(workspaceId: string, conversationId: string, agentId: string): Promise<void> {
        await this.engine.scoped(workspaceId, async (tx) => {
            const hold = await this.byConversation(tx, conversationId)
            if (hold?.agentId === agentId)
                await this.mutations.mutate(tx, { op: "delete", entity: HOLD, key: hold.id }, "job")
        })
    }

    /**
     * True when a customer's line reached an agent other than the one keeping its conversation: it is written again as a customer wake of
     * the keeper, the right to speak in the conversation goes back to the keeper with it, and it starts no run here. Any other wake, and a
     * line to the keeper itself, passes.
     */
    async redirected(turn: AgentTurnView): Promise<boolean> {
        const conversationId = textOf(turn.context.conversationId)
        if (turn.source !== CUSTOMER || conversationId === null) return false
        const hold = await this.holderOf(turn.workspaceId, conversationId)
        if (hold === null || hold.agentId === turn.agentId) return false
        // A keeper whose workflow waits for the founder cannot answer: the line stays with the agent it reached, which serves it.
        if (await this.freezes?.frozen(turn.workspaceId, { conversationId, workflowId: hold.workflowId })) return false
        const context = await this.pinnedContextOf(turn, hold)
        // The front door met the customer and took the right to speak; the keeper answers this line, so the right goes back to it first.
        await this.conversations?.follow(turn.workspaceId, conversationId, hold.agentId)
        await this.entityManager.transaction((tx) =>
            this.wakes.write(tx, {
                workspaceId: turn.workspaceId,
                agentId: hold.agentId,
                source: turn.source,
                eventKey: `${turn.eventKey}${HELD_MARK}${hold.agentId}`,
                context,
                actorMemberId: turn.actorMemberId,
                scopeKey: turn.scopeKey,
                // The front door's wake already waited this line's burst: the keeper's wake must not wait it again (D-P10-2).
                burstSettled: true,
            }),
        )
        this.logger.info(AgentGraphsLogEvent.SentToKeeper, {
            fromAgentId: turn.agentId,
            toAgentId: hold.agentId,
            wakeId: turn.wakeId,
        })
        return true
    }

    /**
     * The context of the line sent on to the keeper: the customer's own (the conversation and the message, so the keeper reads the words
     * as its customer turn), pinned to the keeper's workflow the way an end hand-off pins its target. The keeper's run then goes straight
     * to that workflow (the consult), which no trigger of a channel would take. A keeper running no workflow gets the line unpinned.
     */
    private async pinnedContextOf(turn: AgentTurnView, hold: ConversationHold): Promise<AgentWakeContext> {
        const workflow = (await this.workflows?.workflowKeyOfRun(turn.workspaceId, hold.runId)) ?? null
        if (workflow === null) return turn.context
        const pin = { [WORKFLOW_CALL_MEMBER]: { workflow, version: LATEST_VERSION } }
        return { ...turn.context, tagContext: JSON.stringify({ ...tagPayloadOf(turn.context), ...pin }) }
    }

    private async byConversation(tx: ScopedTx, conversationId: string): Promise<OptionalConversationHold> {
        const page = await this.engine.list(
            tx,
            {
                from: HOLD,
                select: ["agentId", "runId", "heldAt", "workflowId"],
                where: { op: "eq", field: "conversationId", value: conversationId },
                order: [["id", "asc"]],
                page: { size: 1 },
            },
            LIST_SCOPE,
        )
        const row = page.rows.at(0)?.row
        return row === undefined ? null : holdOf(row)
    }
}

import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { nodeSagaOf } from "@nivo-lite/agent-sdk/node"
import { AgentRunsService, type StepSpec } from "@modules/domain/agent-runs"
import {
    AgentWorkHandlersService,
    type AgentHandlerEnding,
    type AgentTurnView,
    type AgentWorkFlow,
} from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FlowTriggerScope } from "./agent-graphs.contracts"
import { InjectFlowTriggerMessages } from "./agent-graphs.decorators"
import type { FlowTriggerMessages } from "./agent-graphs.port"
import { AgentGraphsService } from "./agent-graphs.service"
import {
    GRAPH_FLOW_TRIGGER,
    graphNodeStepOf,
    tagSourceOf,
    triggerScopeOf,
    type GraphNodeStepInput,
} from "./policies/graph-flow.policy"

/** What joins the customer messages of a burst into one text. */
const LINE = "\n"

/** The active node graph of an agent and the version it is frozen in, or null when the agent runs no node graph. */
interface ActiveFlow {
    readonly flow: GraphSpec
    readonly versionId: string
}

@Injectable()
/**
 * Runs the wakes of an agent whose published graph is a node graph, with no model turn. It takes a wake when the active version holds a
 * flow whose tag trigger names where the wake came from, opens the wake's run and writes the step of the first node; the run engine
 * drives the rest, one durable step per node. The steps that follow are the step handler's to write.
 */
export class AgentGraphFlowRunsService implements AgentWorkFlow, OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly graphs: AgentGraphsService,
        private readonly runs: AgentRunsService,
        private readonly handlers: AgentWorkHandlersService,
        private readonly nodes: GraphNodeRegistryService,
        @Optional() @InjectFlowTriggerMessages() private readonly messages: FlowTriggerMessages | null = null,
    ) {}

    /** Sets itself as the flow the drain asks before any handler, once the app has started. */
    onModuleInit(): void {
        this.handlers.setFlow(this)
    }

    /** True when the agent's active node graph is woken from where this wake came from. */
    async takes(turn: AgentTurnView): Promise<boolean> {
        const active = await this.activeOf(turn.workspaceId, turn.agentId)
        return active?.flow.trigger.sources.includes(tagSourceOf(turn)) === true
    }

    /** Opens the wake's run and writes the step of the first node; a replay of the wake finds the run and the step already there. */
    async run(turn: AgentTurnView): Promise<AgentHandlerEnding> {
        const active = await this.activeOf(turn.workspaceId, turn.agentId)
        const first = active?.flow.nodes[0]
        if (active === null || first === undefined) return { status: "skipped", reason: "no_flow", outcome: null }
        const trigger = await this.triggerOf(turn)
        const runId = await this.entityManager.transaction(async (tx) => {
            const opened = await this.runs.open(tx, {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                wakeId: turn.wakeId,
                trigger: GRAPH_FLOW_TRIGGER,
                versionId: active.versionId,
                context: { ...turn.context },
            })
            await this.runs.append(turn.workspaceId, tx, opened.id, [
                this.stepOf(first, { versionId: active.versionId, nodeKey: first.key, trigger }),
            ])
            return opened.id
        })
        return { status: "done", reason: null, outcome: { runId } }
    }

    /**
     * The trigger scope of a wake. A channel wake carries the ids of the customer messages it answers (the message and the burst merged
     * into it), never the words, so they are read from the store: `text` joins them in the order they were said, `messages` keeps each
     * with its time and files, `messageIds` their ids, and `leadId` and `channel` come from the conversation. A tag keeps the words its
     * tagger gave.
     */
    async triggerOf(turn: AgentTurnView): Promise<FlowTriggerScope> {
        const scope = triggerScopeOf(turn)
        const { conversationId, messageId, mergedMessageIds } = turn.context
        if (
            scope.text !== undefined ||
            conversationId === undefined ||
            messageId === undefined ||
            this.messages === null
        ) {
            return scope
        }
        const ids = [messageId, ...(mergedMessageIds === undefined ? [] : mergedMessageIds.split(","))]
        const [said, conversation] = await Promise.all([
            this.messages.messagesOf(turn.workspaceId, conversationId, ids),
            this.messages.conversationOf(turn.workspaceId, conversationId),
        ])
        return {
            ...scope,
            leadId: scope.leadId ?? conversation?.leadId ?? null,
            channel: scope.channel ?? conversation?.channel ?? null,
            text: said.map((message) => message.text).join(LINE),
            messages: said.map((message) => ({ ...message, attachments: [...message.attachments] })),
            messageIds: said.map((message) => message.id),
        }
    }

    /** The step of a node, with its saga kind: a read, compensable when every effect it runs can be undone, else a pivot. */
    stepOf(node: GraphSpecNode, input: GraphNodeStepInput): StepSpec {
        const installed = this.nodes.installed()
        const definition = installed.nodes.get(node.step)
        return graphNodeStepOf(node, input, definition === undefined ? "read" : nodeSagaOf(definition, installed))
    }

    private async activeOf(workspaceId: string, agentId: string): Promise<ActiveFlow | null> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const flow = state?.active?.flow
        return flow === undefined || state?.activeVersionId == null ? null : { flow, versionId: state.activeVersionId }
    }
}

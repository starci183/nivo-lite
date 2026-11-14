import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { agentTagEffect, type EffectCall, type EffectPayload, type SubjectRef } from "@nivo-lite/agent-sdk/node"
import { LATEST_VERSION, WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import type { TagWorkflowCall } from "./agents.contracts"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    GraphNodeRegistryService,
    ledgerKeyOf,
    type NodeEffectExecutor,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { WorkflowCallReachService } from "./workflow-call-reach.service"

/** The effect this executor runs. */
const AGENT_TAG = agentTagEffect.id

/** A tag no retry changes, reporting the node refusal the step records (`params.refusal`): no target, no call, or the delivery refused it. */
const refusalOf = (code: AgentsErrorCode, refusal: "EFFECT_PAYLOAD_INVALID"): AgentsError =>
    new AgentsError({ code, params: { refusal, effect: AGENT_TAG } })

/** The kind of subject a tag touches: the wake it wrote in the tagged agent. */
const WAKE = "wake"

/** The member of a call's context that names the calling run (as `core.call-workflow` writes it). */
const CALLER_MEMBER = "caller"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** What a tag's context names of a workflow call (`core.call-workflow`): the pin, the mapped params and the calling run; null for none. */
const callOfTag = (context: unknown): TagWorkflowCall | null => {
    if (!isRecord(context)) return null
    const call = context[WORKFLOW_CALL_MEMBER]
    if (!isRecord(call) || typeof call.workflow !== "string" || call.workflow === "") return null
    const { version } = call
    const pinned =
        version === LATEST_VERSION || (typeof version === "number" && Number.isSafeInteger(version) && version > 0)
    if (!pinned) return null
    const params = context[WORKFLOW_PARAMS_MEMBER]
    const caller = context[CALLER_MEMBER]
    return {
        pin: { workflow: call.workflow, version },
        params: isRecord(params) ? params : {},
        runId: isRecord(caller) && typeof caller.runId === "string" && caller.runId !== "" ? caller.runId : null,
    }
}

@Injectable()
/**
 * The executor of `nivo.tool.agent.tag`: a run's WORKFLOW CALL (`core.call-workflow`, which always pins its target) delivered to the target
 * agent through the one delivery function. The target is an agent, or the agent the workspace runs for a module. The effect's ledger key
 * is the call's event key, so a step tried again starts the callee once. A tag that names no call (a plain tag: ruling R34, its road is
 * deleted; a person tagging an agent goes through the team chat's hand-over onto `deliver`), or one with no target, is refused: no
 * failure a retry changes.
 */
export class AgentTagEffectService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: string = AGENT_TAG

    constructor(
        private readonly reach: WorkflowCallReachService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() @InjectPrimaryEntityManager() private readonly entityManager?: EntityManager,
        @Optional() private readonly triggers?: ProviderTriggersService,
    ) {}

    /** Registers with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Delivers the turn's workflow call to the target agent and answers the wake it wrote. */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const tag = agentTagEffect.payload.parse(payload)
        const toAgentId =
            tag.toModuleKey === undefined
                ? tag.toAgentId
                : await this.reach.agentOf(turn.workspaceId, tag.conversationId ?? turn.conversationId ?? null, tag.toModuleKey)
        if (toAgentId == null) throw refusalOf(AgentsErrorCode.TagTargetMissing, "EFFECT_PAYLOAD_INVALID")
        const eventKey = ledgerKeyOf(call)
        // A workflow call (`core.call-workflow`) is an event of the one pipeline: `workflow.called`, pinned, with its provenance.
        const called = callOfTag(tag.context)
        if (called === null) throw refusalOf(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID")
        return this.called(turn, toAgentId, eventKey, called, tag.conversationId ?? turn.conversationId)
    }

    /**
     * Delivers a run's workflow call through the one delivery function: the call's params are the event's `data`, the pin names the one
     * workflow it may start (MATCH honours it), and the calling agent and run ride with it for the call guards (depth, cycle, duplicate,
     * open to) and the hand-off's right to speak. Keyed once by the step's ledger key, so a step tried again starts the callee once. A pin
     * no live registration of the target takes is refused (the step stops for a person: never a silent drop).
     */
    private async called(
        turn: NodeTurn,
        toAgentId: string,
        eventKey: string,
        call: TagWorkflowCall,
        routeId: string | null | undefined,
    ): Promise<SubjectRef> {
        const { entityManager, triggers } = this
        if (entityManager === undefined || triggers === undefined)
            throw refusalOf(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID")
        const event = WORKFLOW_CALL_TRIGGER.translate({ key: eventKey, params: call.params }, { connectionId: null })
        if (event === null) throw refusalOf(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID")
        const result = await entityManager.transaction((tx) =>
            triggers.deliver(
                {
                    workspaceId: turn.workspaceId,
                    declaration: WORKFLOW_CALL_TRIGGER,
                    connectionId: null,
                    agentId: toAgentId,
                    events: [
                        {
                            event,
                            pin: call.pin,
                            caller: { agentId: turn.agentId, runId: call.runId },
                            contactId: turn.contactId ?? null,
                            routeId: routeId ?? null,
                        },
                    ],
                },
                tx,
            ),
        )
        if (result.status !== "delivered") throw refusalOf(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID")
        const [woken] = result.woken
        if (woken !== undefined) return { kind: WAKE, id: woken.wakeId }
        if (result.repeats > 0) return { kind: WAKE, id: eventKey }
        throw refusalOf(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID")
    }
}

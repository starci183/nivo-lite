import { Injectable } from "@nestjs/common"
import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { tagContextOf } from "@modules/domain/agent-work"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import {
    PROVIDER_TRIGGER_TAG_SOURCE,
    wakeContextOf,
    type ProviderTriggerReceivers,
    type ProviderWake,
} from "@modules/domain/provider-triggers"
import type { TriggerTaker } from "@modules/domain/provider-triggers/provider-triggers.contracts"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { tagSourceOf, triggerScopeOf, type FlowWake } from "./policies/graph-flow.policy"
import { wakeVerbOf } from "./policies/workflow-trigger.policy"

/** The member of a compiled registration that names its own correlation key (`WorkflowTrigger.correlationKey`, ROAD-API section 2). */
const OWN_KEY_MEMBER = "correlationKey"

/** A sample wake of a provider trigger as routing reads it (the registry read's question): a system tag carrying the trigger's data. */
const flowWakeOf = (wake: ProviderWake): FlowWake => ({
    source: "tag",
    context: tagContextOf(
        { source: PROVIDER_TRIGGER_TAG_SOURCE, workspaceId: "", toAgentId: "", text: wake.providerTrigger },
        JSON.stringify(wakeContextOf(wake, "notice")),
    ),
    actorMemberId: null,
})

@Injectable()
/**
 * Who an event of the one pipeline may wake (`ProviderTriggersService.deliver`): the agents attached to the account (their attachment is
 * their right to it), and, for each, the active workflow whose registration on the verb takes it (MATCH), or whether a `wait` step of one
 * of its active workflows lists the verb (`waitsOn`: then a parked run of it may take the event, and with none it starts nothing).
 */
export class AgentWorkflowTriggerReceiversService implements ProviderTriggerReceivers {
    constructor(
        private readonly access: AccountAttachmentsService,
        private readonly runs: AgentWorkflowRunsService,
    ) {}

    /** The agents attached to the account, in the store's order (by agent). */
    async attachedTo(workspaceId: string, connectionId: string): Promise<ReadonlyArray<string>> {
        const attachments = await this.access.listOfWorkspace(workspaceId)
        return [...new Set(attachments.filter((one) => one.connectionId === connectionId).map((one) => one.agentId))]
    }

    /** For each sample wake, whether the agent listens to it: an active workflow takes it at its head, or a `wait` of one lists its verb. */
    async registered(workspaceId: string, agentId: string, wakes: ReadonlyArray<ProviderWake>): Promise<ReadonlyArray<boolean>> {
        const flowWakes = wakes.map((wake) => flowWakeOf(wake))
        const takers = await this.runs.takersOf(workspaceId, agentId, flowWakes)
        if (takers.every((taker) => taker !== null)) return takers.map(() => true)
        const waits = await this.runs.waitVerbsOf(workspaceId, agentId)
        return takers.map((taker, index) => {
            if (taker !== null) return true
            const wake = flowWakes[index]
            const verb = wake === undefined ? null : wakeVerbOf(tagSourceOf(wake), triggerScopeOf(wake))
            return verb !== null && waits.has(verb)
        })
    }

    /** MATCH of the one event pipeline: the workflow of the agent whose registration takes the event, and its own key. */
    async takerOf(
        workspaceId: string,
        agentId: string,
        verb: TriggerVerb,
        scope: Readonly<Record<string, unknown>>,
        onlyWorkflowId: string | null = null,
        onlyWorkflowKey: string | null = null,
    ): Promise<TriggerTaker | null> {
        const taker = await this.runs.takerOfEvent(workspaceId, agentId, verb, scope, onlyWorkflowId, onlyWorkflowKey)
        if (taker === null) return null
        const ownKey: unknown = Reflect.get(taker.registration, OWN_KEY_MEMBER)
        return {
            workflowId: taker.workflowId,
            ownKey: typeof ownKey === "string" && ownKey !== "" ? ownKey : null,
        }
    }

    /** Whether a `wait` step of an active workflow of the agent lists the verb: a run parked there may take an event of it. */
    async waitsOn(workspaceId: string, agentId: string, verb: TriggerVerb): Promise<boolean> {
        return (await this.runs.waitVerbsOf(workspaceId, agentId)).has(verb)
    }
}

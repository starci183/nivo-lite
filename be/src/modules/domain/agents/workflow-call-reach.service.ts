import { Injectable, Optional } from "@nestjs/common"
import {
    InjectProviderTriggerReceivers,
    eventScopeOf,
    type ProviderTriggerReceivers,
} from "@modules/domain/provider-triggers"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { InjectChannelOwners, InjectInstallations } from "./agents.decorators"
import type { ConversationChannelOwners, InstallationDirectory } from "./agents.port"

/** The id of the probe event a reach check matches with (never written: MATCH is read only). */
const PROBE_EVENT = "reach-probe"

/** Where a call is made from: the workspace, and the route and person of the calling run (none outside a conversation). */
export interface CallOrigin {
    readonly workspaceId: string
    readonly routeId: string | null
    readonly contactId: string | null
}

/** A workflow call as a step names it: the target module and the workflow's key there. */
export interface CalledWorkflowRef {
    readonly module: string
    readonly workflow: string
}

@Injectable()
/**
 * THE ONE ANSWER to "who takes a workflow call, and can it start here" (rule: a call reaches a workflow only through an agent of the
 * target module and a live registration of that workflow on the call's verb). The call effect (`AgentTagEffectService`) resolves its
 * target with `agentOf` and delivers through MATCH; a step that wants to know beforehand (the engine's `run.unreachable`) asks
 * `startable`, which runs the SAME agent resolution and the SAME MATCH read (`ProviderTriggerReceivers.takerOf` with the call's pin),
 * writing nothing. A registration whose conditions read the call's data is judged on a call that carries none.
 */
export class WorkflowCallReachService {
    constructor(
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectChannelOwners() private readonly channelOwners: ConversationChannelOwners,
        @Optional() @InjectProviderTriggerReceivers() private readonly receivers: ProviderTriggerReceivers | null = null,
    ) {}

    /**
     * The agent of a module a call goes to: the one that answers the channel of the route (one role, many agents: each channel has one
     * agent per role), else the oldest agent the workspace runs for the module; null when the workspace runs none.
     */
    async agentOf(workspaceId: string, routeId: string | null, moduleKey: string): Promise<string | null> {
        const owner = routeId === null ? null : await this.channelOwners.ownerAgentOf(workspaceId, routeId, moduleKey)
        return owner ?? (await this.installations.firstOfModule(workspaceId, moduleKey))?.agentId ?? null
    }

    /**
     * Whether this workspace can start the call: an agent of the module answers it AND a live registration of that workflow takes a
     * call pinned to it (the delivery's own MATCH). With no MATCH reader bound (an app that delivers nothing) the agent alone answers.
     */
    async startable(origin: CallOrigin, call: CalledWorkflowRef): Promise<boolean> {
        const agentId = await this.agentOf(origin.workspaceId, origin.routeId, call.module)
        if (agentId === null) return false
        if (this.receivers === null) return true
        const scope = eventScopeOf({
            eventId: PROBE_EVENT,
            accountId: null,
            contactId: origin.contactId,
            routeId: origin.routeId,
            data: {},
            files: [],
        })
        const taker = await this.receivers.takerOf(
            origin.workspaceId,
            agentId,
            WORKFLOW_CALL_TRIGGER.verb,
            { ...scope },
            null,
            call.workflow,
        )
        return taker !== null
    }
}

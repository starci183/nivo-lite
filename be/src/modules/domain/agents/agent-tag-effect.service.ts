import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { NodeRunError, RightsDeniedError } from "@nivo-lite/agent-sdk/node"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { agentTagEffect } from "@nivo-lite/blocks-core"
import { AgentTagService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService, ledgerKeyOf } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectInstallations } from "./agents.decorators"
import type { InstallationDirectory } from "./agents.port"

/** The effect this executor runs. */
const AGENT_TAG = agentTagEffect.id

/** The kind of subject a tag touches: the wake it wrote in the tagged agent. */
const WAKE = "wake"

@Injectable()
/**
 * The executor of `agent.tag`: a node of one agent's graph tags another agent through the one tag door, so the tag rights, the origin
 * and the target's tag trigger are the door's. The target is an agent, or the agent the workspace runs for a module. The effect's ledger
 * key is the tag's event key, so a step tried again wakes the target once. A tag the rights refuse, or one with no target, is no
 * failure a retry changes.
 */
export class AgentTagEffectService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: string = AGENT_TAG

    constructor(
        private readonly registry: GraphNodeRegistryService,
        private readonly tags: AgentTagService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
    ) {}

    /** Registers with the node host once the app has started. */
    onModuleInit(): void {
        this.registry.addExecutor(this)
    }

    /** Tags the target agent for the turn's agent and answers the wake it wrote. */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const tag = agentTagEffect.payload.parse(payload)
        const toAgentId =
            tag.toModuleKey === undefined ? tag.toAgentId : await this.agentOfModule(turn.workspaceId, tag.toModuleKey)
        if (toAgentId == null) throw new NodeRunError("EFFECT_PAYLOAD_INVALID", AGENT_TAG)
        const eventKey = ledgerKeyOf(call)
        const result = await this.tags.tagAgent({
            fromAgentId: turn.agentId,
            workspaceId: turn.workspaceId,
            toAgentId,
            text: tag.text,
            conversationId: tag.conversationId ?? turn.conversationId,
            locale: turn.locale,
            eventKey,
            ...(tag.subject === undefined ? {} : { subject: `${tag.subject.kind}:${tag.subject.id}` }),
            ...(tag.leadId === undefined ? {} : { leadId: tag.leadId }),
            ...(tag.channel === undefined ? {} : { channel: tag.channel }),
            ...(tag.context === undefined ? {} : { context: tag.context }),
        })
        if (result.tagged) return { kind: WAKE, id: result.wakeId }
        if (result.reason === "duplicate") return { kind: WAKE, id: eventKey }
        if (result.reason === "not_allowed") throw new RightsDeniedError(AGENT_TAG)
        throw new NodeRunError("EFFECT_PAYLOAD_INVALID", AGENT_TAG)
    }

    private async agentOfModule(workspaceId: string, moduleKey: string): Promise<string | null> {
        return (await this.installations.firstOfModule(workspaceId, moduleKey))?.agentId ?? null
    }
}

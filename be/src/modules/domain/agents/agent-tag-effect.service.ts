import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { agentTagEffect } from "@nivo-lite/blocks-core"
import { AgentTagService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService, ledgerKeyOf } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { InjectChannelOwners, InjectInstallations } from "./agents.decorators"
import type { ConversationChannelOwners, InstallationDirectory } from "./agents.port"

/** The effect this executor runs. */
const AGENT_TAG = agentTagEffect.id

/** A tag no retry changes, reporting the node refusal the step records (`params.refusal`): no target, or the rights or the door refused it. */
const refusalOf = (code: AgentsErrorCode, refusal: "EFFECT_PAYLOAD_INVALID" | "RIGHTS_DENIED"): AgentsError =>
    new AgentsError({ code, params: { refusal, effect: AGENT_TAG } })

/** The kind of subject a tag touches: the wake it wrote in the tagged agent. */
const WAKE = "wake"

@Injectable()
/**
 * The executor of `nivo.agent.tag`: a node of one agent's graph tags another agent through the one tag door, so the tag rights, the origin
 * and the target's tag trigger are the door's. The target is an agent, or the agent the workspace runs for a module. The effect's ledger
 * key is the tag's event key, so a step tried again wakes the target once. A tag the rights refuse, or one with no target, is no
 * failure a retry changes.
 */
export class AgentTagEffectService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: string = AGENT_TAG

    constructor(
        private readonly tags: AgentTagService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectChannelOwners() private readonly channelOwners: ConversationChannelOwners,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Tags the target agent for the turn's agent and answers the wake it wrote. */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const tag = agentTagEffect.payload.parse(payload)
        const toAgentId =
            tag.toModuleKey === undefined
                ? tag.toAgentId
                : await this.agentOfModule(
                      turn.workspaceId,
                      tag.conversationId ?? turn.conversationId,
                      tag.toModuleKey,
                      tag.leadId ?? null,
                  )
        if (toAgentId == null) throw refusalOf(AgentsErrorCode.TagTargetMissing, "EFFECT_PAYLOAD_INVALID")
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
            ...(tag.visibility === undefined ? {} : { visibility: tag.visibility }),
        })
        if (result.tagged) return { kind: WAKE, id: result.wakeId }
        // A hand-off that waits for the holder of its conversation is written as its wake later, under the same event key.
        if (result.reason === "duplicate" || result.reason === "queued") return { kind: WAKE, id: eventKey }
        if (result.reason === "not_allowed") throw refusalOf(AgentsErrorCode.TagRefused, "RIGHTS_DENIED")
        throw refusalOf(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID")
    }

    /**
     * The agent of a module a tag goes to: the one that answers the channel of the turn's conversation (one role, many agents: each
     * channel has one agent per role), else the oldest agent the workspace runs for the module.
     */
    private async agentOfModule(
        workspaceId: string,
        conversationId: string | null,
        moduleKey: string,
        leadId: string | null,
    ): Promise<string | null> {
        const owner = await this.channelOwnerOf(workspaceId, conversationId, leadId, moduleKey)
        return owner ?? (await this.installations.firstOfModule(workspaceId, moduleKey))?.agentId ?? null
    }

    /** The owner of the channel of the turn's conversation, else of the channel the tagged customer last wrote on; the tag stays out of the conversation's queue. */
    private channelOwnerOf(
        workspaceId: string,
        conversationId: string | null,
        leadId: string | null,
        moduleKey: string,
    ): Promise<string | null> {
        if (conversationId !== null) return this.channelOwners.ownerAgentOf(workspaceId, conversationId, moduleKey)
        if (leadId !== null) return this.channelOwners.ownerAgentOfLead(workspaceId, leadId, moduleKey)
        return Promise.resolve(null)
    }
}

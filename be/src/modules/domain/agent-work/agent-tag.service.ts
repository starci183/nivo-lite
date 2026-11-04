import { randomUUID } from "node:crypto"
import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentSpeakerQueueService } from "./agent-speaker-queue.service"
import type { QueuedTag } from "./agent-speaker-queue.contracts"
import { AgentWakeService } from "./agent-wake.service"
import { tagContextOf, tagPayloadTextOf } from "./agent-tag.policy"
import { InjectAgentTagRights, InjectAgentTagVisibility } from "./agent-work.decorators"
import type { AgentTagNotice, AgentTagRequest, AgentTagResult, AgentTaggedByAgent } from "./agent-tag.contracts"
import type { AgentTagRights, AgentTagVisibilityPort } from "./agent-work.port"

/** True for a hand-off of one agent to another in a customer conversation: the kind that passes the right to speak. */
const isAgentHandOff = (
    request: AgentTagRequest,
): request is AgentTaggedByAgent & { readonly conversationId: string } =>
    "fromAgentId" in request && typeof request.conversationId === "string" && request.conversationId !== ""

@Injectable()
/**
 * The one door a tag starts through: another agent's end node, a person's @ in a group chat, a system event or a feed. It checks the
 * right when an agent tags, records who or what tagged on the wake, and writes the wake that starts the target agent's graph at its
 * tag trigger. Without a right port bound an agent tag is refused: default deny.
 *
 * It also keeps the one speaker of a customer conversation. An agent that hands a conversation off passes the right to speak with it,
 * whether the hand-off shows in the chat or moves silently; a hand-off made while another agent holds the conversation waits, in
 * order, and its wake is written only when the holder hands the conversation on. When the holder's work is done, the conversation
 * goes to the next hand-off that waits, else back to the agent that opened the door. A send by an agent that does not hold the
 * conversation is refused by the sender's own rule, so two agents never speak at once.
 */
export class AgentTagService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly wakes: AgentWakeService,
        private readonly queue: AgentSpeakerQueueService,
        @Optional() @InjectAgentTagRights() private readonly rights: AgentTagRights | null = null,
        @Optional() @InjectAgentTagVisibility() private readonly visibility: AgentTagVisibilityPort | null = null,
    ) {}

    /** Tags the agent in the caller's transaction, or in one of its own; answers the wake, or why nothing was written. */
    tagAgent(request: AgentTagRequest, tx?: EntityManager): Promise<AgentTagResult> {
        return tx === undefined
            ? this.entityManager.transaction((own) => this.write(request, own))
            : this.write(request, tx)
    }

    /**
     * The agent's work in the conversation is done: when it holds the conversation, the right to speak goes to the oldest hand-off that
     * waits (whose wake is written now), else back to the agent that opened the door. An agent that does not hold it changes nothing.
     */
    release(workspaceId: string, conversationId: string, agentId: string): Promise<void> {
        return this.entityManager.transaction(async (tx) => {
            if (this.visibility === null) return
            if ((await this.visibility.holderOf(workspaceId, conversationId)) !== agentId) return
            const next = await this.queue.takeNext(workspaceId, conversationId, tx)
            if (next === null) {
                await this.visibility.handBack(workspaceId, conversationId, agentId)
                return
            }
            await this.wake(next, tx)
            await this.passTo({ ...this.noticeOf(next), fromAgentId: agentId }, next, tx)
        })
    }

    private async write(request: AgentTagRequest, tx: EntityManager): Promise<AgentTagResult> {
        if ("fromAgentId" in request && !(await this.mayTag(request.fromAgentId, request.toAgentId))) {
            return { tagged: false, reason: "not_allowed" }
        }
        if (tagPayloadTextOf(request) === null) return { tagged: false, reason: "too_large" }
        if (await this.waitsForHolder(request, tx)) return { tagged: false, reason: "queued" }
        const id = await this.wake(request, tx)
        if (id === null) return { tagged: false, reason: "duplicate" }
        await this.show(request, tx)
        return { tagged: true, wakeId: id }
    }

    /** Writes the wake that starts the target's graph; null when the same tag was already written. */
    private wake(request: AgentTagRequest, tx: EntityManager): Promise<string | null> {
        const payload = tagPayloadTextOf(request) ?? undefined
        return this.wakes.write(tx, {
            workspaceId: request.workspaceId,
            agentId: request.toAgentId,
            source: "tag",
            eventKey: request.eventKey ?? `tag:${randomUUID()}`,
            context: tagContextOf(request, payload),
            actorMemberId: "personId" in request ? request.personId : null,
        })
    }

    /**
     * Keeps an agent's hand-off back while a third agent holds its conversation: it waits for the holder to hand the conversation on.
     * A hand-off from the holder, or to it, goes at once.
     */
    private async waitsForHolder(request: AgentTagRequest, tx: EntityManager): Promise<boolean> {
        if (this.visibility === null || !isAgentHandOff(request)) return false
        const holder = await this.visibility.holderOf(request.workspaceId, request.conversationId)
        if (holder === null || holder === request.fromAgentId || holder === request.toAgentId) return false
        await this.queue.keep({ ...request, eventKey: request.eventKey ?? `tag:${randomUUID()}` }, tx)
        return true
    }

    /**
     * Shows the hand-off in its conversation (`chat`, a visible line) or not (`redirect`); an agent's hand-off also passes the right to
     * speak to the target either way. A tag with no conversation shows nothing.
     */
    private async show(request: AgentTagRequest, tx: EntityManager): Promise<void> {
        if (this.visibility === null || request.conversationId == null) return
        const notice = this.noticeOf({ ...request, conversationId: request.conversationId })
        if (request.visibility !== "redirect") await this.visibility.announce(notice, tx)
        if (notice.fromAgentId !== null) await this.visibility.redirect(notice)
    }

    /** Passes the right to speak to the hand-off that waited, with its line when it shows in the chat. */
    private async passTo(notice: AgentTagNotice, tag: QueuedTag, tx: EntityManager): Promise<void> {
        if (this.visibility === null) return
        if (tag.visibility !== "redirect") await this.visibility.announce(notice, tx)
        await this.visibility.redirect(notice)
    }

    private noticeOf(request: (AgentTagRequest | QueuedTag) & { readonly conversationId: string }): AgentTagNotice {
        return {
            workspaceId: request.workspaceId,
            conversationId: request.conversationId,
            fromAgentId: "fromAgentId" in request ? request.fromAgentId : null,
            toAgentId: request.toAgentId,
            text: request.text,
        }
    }

    private async mayTag(fromAgentId: string, toAgentId: string): Promise<boolean> {
        return this.rights !== null && fromAgentId !== toAgentId && (await this.rights.canTag(fromAgentId, toAgentId))
    }
}

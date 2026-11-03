import { randomUUID } from "node:crypto"
import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentWakeService } from "./agent-wake.service"
import { tagContextOf, tagPayloadTextOf } from "./agent-tag.policy"
import { InjectAgentTagRights, InjectAgentTagVisibility } from "./agent-work.decorators"
import type { AgentTagRequest, AgentTagResult } from "./agent-tag.contracts"
import type { AgentTagRights, AgentTagVisibilityPort } from "./agent-work.port"

@Injectable()
/**
 * The one door a tag starts through: another agent's end node, a person's @ in a group chat, a system event or a feed. It checks the
 * right when an agent tags, records who or what tagged on the wake, and writes the wake that starts the target agent's graph at its
 * tag trigger. Without a right port bound an agent tag is refused: default deny.
 */
export class AgentTagService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly wakes: AgentWakeService,
        @Optional() @InjectAgentTagRights() private readonly rights: AgentTagRights | null = null,
        @Optional() @InjectAgentTagVisibility() private readonly visibility: AgentTagVisibilityPort | null = null,
    ) {}

    /** Tags the agent in the caller's transaction, or in one of its own; answers the wake, or why nothing was written. */
    tagAgent(request: AgentTagRequest, tx?: EntityManager): Promise<AgentTagResult> {
        return tx === undefined
            ? this.entityManager.transaction((own) => this.write(request, own))
            : this.write(request, tx)
    }

    private async write(request: AgentTagRequest, tx: EntityManager): Promise<AgentTagResult> {
        if ("fromAgentId" in request && !(await this.mayTag(request.fromAgentId, request.toAgentId))) {
            return { tagged: false, reason: "not_allowed" }
        }
        const payload = tagPayloadTextOf(request)
        if (payload === null) return { tagged: false, reason: "too_large" }
        const id = await this.wakes.write(tx, {
            workspaceId: request.workspaceId,
            agentId: request.toAgentId,
            source: "tag",
            eventKey: request.eventKey ?? `tag:${randomUUID()}`,
            context: tagContextOf(request, payload),
            actorMemberId: "personId" in request ? request.personId : null,
        })
        if (id === null) return { tagged: false, reason: "duplicate" }
        await this.show(request, tx)
        return { tagged: true, wakeId: id }
    }

    /** Shows the hand-off in its conversation (`chat`) or moves the conversation silently (`redirect`); a tag with no conversation shows nothing. */
    private async show(request: AgentTagRequest, tx: EntityManager): Promise<void> {
        if (this.visibility === null || request.conversationId == null) return
        const notice = {
            workspaceId: request.workspaceId,
            conversationId: request.conversationId,
            fromAgentId: "fromAgentId" in request ? request.fromAgentId : null,
            toAgentId: request.toAgentId,
            text: request.text,
        }
        if (request.visibility === "redirect") await this.visibility.redirect(notice)
        else await this.visibility.announce(notice, tx)
    }

    private async mayTag(fromAgentId: string, toAgentId: string): Promise<boolean> {
        return this.rights !== null && fromAgentId !== toAgentId && (await this.rights.canTag(fromAgentId, toAgentId))
    }
}

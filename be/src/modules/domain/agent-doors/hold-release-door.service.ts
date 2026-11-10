import { Injectable } from "@nestjs/common"
import { AgentGraphConversationReleaseService } from "@modules/domain/agent-graphs"
import type { ConversationRelease, ReleaseHold } from "@modules/domain/agent-graphs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { DoorPressesService } from "./door-presses.service"

/** The door a release press is recorded under. */
const RELEASE = "conversation.release"

const HOLDS: ReadonlyArray<ReleaseHold> = ["person", "agent", "both"]

/** The hold a caller names, or `both` when it names none or an unknown one. */
export const releaseHoldOf = (value: string | null | undefined): ReleaseHold => HOLDS.find((one) => one === value) ?? "both"

@Injectable()
/**
 * "hand back to the agent": an owner or a manager hands a conversation back. A person's take-over (`handledBy`) and an agent's consult hold
 * are cleared through the engine's own release (`AgentGraphConversationReleaseService`, which frees the hold through
 * `AgentGraphConversationHoldsService.free`); a press that released something is recorded with who and when.
 */
export class HoldReleaseDoorService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly members: WorkspaceMembersService,
        private readonly release: AgentGraphConversationReleaseService,
        private readonly presses: DoorPressesService,
    ) {}

    /** Hands the conversation back. Owner or manager only. */
    async hand(userId: string, workspaceId: string, conversationId: string, hold: ReleaseHold): Promise<ConversationRelease> {
        const memberId = await this.access.manager(userId, workspaceId)
        const released = await this.release.release(workspaceId, conversationId, hold)
        if (released.outcome !== "released") return released
        const member = await this.members.require(userId, workspaceId)
        await this.presses.record({
            workspaceId,
            door: RELEASE,
            subject: conversationId,
            memberId,
            memberName: member.displayName,
            outcome: released.outcome,
            detail: { hold, person: released.person !== null, agentId: released.agentId },
        })
        return released
    }
}

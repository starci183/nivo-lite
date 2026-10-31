import { Injectable } from "@nestjs/common"
import type { AgentWakeSource } from "@modules/domain/agent-work"
import { PresentedRole, WorkspaceMembersService } from "@modules/domain/workspace-members"

@Injectable()
/**
 * Whether the person behind a turn may have it write. Only a tag written by an owner or a manager may; a background turn never has a
 * person behind it, and a staff member's tag reads and asks, never writes. A tool call and a proposed action are judged by this one rule.
 */
export class AgentWriteRightService {
    constructor(private readonly members: WorkspaceMembersService) {}

    /** True for a tag whose author is an owner or a manager of the workspace. */
    async mayWrite(source: AgentWakeSource, authorUserId: string | null, workspaceId: string): Promise<boolean> {
        if (source !== "tag" || authorUserId === null) return false
        const role = await this.members.roleOf(authorUserId, workspaceId)
        return role === PresentedRole.Owner || role === PresentedRole.Manager
    }
}

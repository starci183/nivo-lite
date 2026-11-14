import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { WorkspaceMemberEntity } from "./persistence/entities"

/** A second open within this window keeps the stamp it has: opening a workspace is not a write per request. */
const OPENED_STAMP_MS = 60_000

/** The table guard raises `last_owner` when a change would leave a workspace without an active owner. */
const isLastOwnerFailure = (cause: unknown): boolean => cause instanceof Error && cause.message.includes("last_owner")

@Injectable()
/** What the workspaces lobby changes on a seat: the last open, leaving a workspace, and the seats of a deleted workspace. */
export class MemberLobbyService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly events: EventsService,
    ) {}

    /** Stamps when the person opened the workspace on their active seat; an open within the last minute keeps its stamp. */
    async markOpened(workspaceId: string, userId: string): Promise<void> {
        const now = this.clock.now()
        await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .update()
            .set({ lastOpenedAt: now })
            .where("workspace_id = :workspaceId AND user_id = :userId AND status = 'active'", { workspaceId, userId })
            .andWhere("(last_opened_at IS NULL OR last_opened_at < :stale)", {
                stale: new Date(now.getTime() - OPENED_STAMP_MS),
            })
            .execute()
    }

    /**
     * The person leaves the workspace: their seat goes, active or disabled (their account and past work stay). The last active
     * owner cannot leave; they hand the ownership on or delete the workspace.
     */
    async leave(userId: string, workspaceId: string): Promise<void> {
        const seat = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: { id: true, displayName: true },
            where: { workspaceId, userId },
        })
        if (seat === null) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.NotMember })
        await this.entityManager.delete(WorkspaceMemberEntity, { id: seat.id }).catch((cause: unknown) => {
            if (isLastOwnerFailure(cause)) {
                throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.LastOwnerLeave, cause })
            }
            throw cause
        })
        await this.events.record({
            workspaceId,
            kind: "member.left",
            actor: seat.displayName,
            summary: seat.displayName,
        })
    }

    /** Disables every active seat of a workspace its owner deleted, marked as the deletion's, inside the deletion's transaction. */
    async disableAll(workspaceId: string, manager: EntityManager): Promise<void> {
        await manager.update(
            WorkspaceMemberEntity,
            { workspaceId, status: "active" },
            { status: "disabled", disabledByDeletion: true },
        )
    }

    /** Switches on again exactly the seats the deletion switched off, inside the restore's transaction. */
    async enableAfterRestore(workspaceId: string, manager: EntityManager): Promise<void> {
        await manager.update(
            WorkspaceMemberEntity,
            { workspaceId, disabledByDeletion: true },
            { status: "active", disabledByDeletion: false },
        )
    }

    /** Whether the person holds an owner seat in the workspace, whatever its status (a deleted workspace's owner seat is off). */
    holdsOwnerSeat(workspaceId: string, userId: string, manager: EntityManager): Promise<boolean> {
        return manager.exists(WorkspaceMemberEntity, { where: { workspaceId, userId, role: "owner" } })
    }
}

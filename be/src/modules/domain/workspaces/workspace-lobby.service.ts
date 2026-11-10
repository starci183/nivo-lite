import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { MemberLobbyService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { RESTORE_DAYS } from "./workspaces.contracts"

const DAY_MS = 86_400_000

/** The longest workspace name. */
const NAME_MAX = 120

const MANAGERS = ["owner", "manager"] as const

@Injectable()
/** What a member manages of a workspace from the workspaces lobby: its name, and its deletion and restore by the owner. */
export class WorkspaceLobbyService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly seats: MemberLobbyService,
    ) {}

    /** Renames a living workspace; its owner or a manager only. */
    async rename(userId: string, workspaceId: string, name: string): Promise<void> {
        const trimmed = name.trim()
        if (trimmed.length === 0 || trimmed.length > NAME_MAX)
            throw new WorkspacesError({ code: WorkspacesErrorCode.NameInvalid })
        await this.members.require(userId, workspaceId, MANAGERS)
        const result = await this.entityManager.update(
            WorkspaceEntity,
            { id: workspaceId, deletedAt: IsNull() },
            { name: trimmed },
        )
        if ((result.affected ?? 0) === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
    }

    /**
     * Deletes a workspace as its owner, who confirms by typing its name: a soft delete. The workspace keeps its rows and every seat
     * is disabled in the same transaction, so nobody reaches it any more; the operator's prune removes it later.
     */
    async remove(userId: string, workspaceId: string, confirmName: string): Promise<void> {
        await this.members.require(userId, workspaceId, ["owner"])
        await this.entityManager.transaction(async (tx) => {
            const workspace = await tx.findOne(WorkspaceEntity, {
                select: { id: true, name: true },
                where: { id: workspaceId, deletedAt: IsNull() },
                lock: { mode: "pessimistic_write" },
            })
            if (workspace === null) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
            if (confirmName.trim() !== workspace.name.trim())
                throw new WorkspacesError({ code: WorkspacesErrorCode.DeleteConfirmMismatch })
            await tx.update(WorkspaceEntity, { id: workspaceId }, { deletedAt: this.clock.now() })
            await this.seats.disableAll(workspaceId, tx)
        })
    }

    /**
     * Restores a workspace its owner deleted, within the restore window: it lives again and the seats the deletion switched off are on
     * again, in one transaction. The owner's own seat is off while the workspace is deleted, so the proof is an owner seat in any status.
     */
    async restore(userId: string, workspaceId: string): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            const workspace = await tx.findOne(WorkspaceEntity, {
                select: { id: true, deletedAt: true },
                where: { id: workspaceId, deletedAt: Not(IsNull()) },
                lock: { mode: "pessimistic_write" },
            })
            if (workspace?.deletedAt == null || !(await this.seats.holdsOwnerSeat(workspaceId, userId, tx)))
                throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
            if (this.clock.now().getTime() - workspace.deletedAt.getTime() > RESTORE_DAYS * DAY_MS)
                throw new WorkspacesError({ code: WorkspacesErrorCode.RestoreExpired })
            await tx.update(WorkspaceEntity, { id: workspaceId }, { deletedAt: null })
            await this.seats.enableAfterRestore(workspaceId, tx)
        })
    }
}

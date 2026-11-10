import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"

/** The states of a work item that still waits on the person it is assigned to. */
const OPEN_STATES = ["queued", "waiting_decision"] as const

@Injectable()
/** The work a member has in hand in a workspace: the open work items assigned to the staff row their seat is. */
export class WorkInHandService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** How many open work items are assigned to the caller's staff row; none for a seat that is no staff row. */
    async openCountOf(userId: string, workspaceId: string): Promise<number> {
        const seat = await this.members.require(userId, workspaceId)
        if (seat.staffId === null) return 0
        return this.entityManager.count(WorkItemEntity, {
            where: { workspaceId, assignedStaffId: seat.staffId, status: In([...OPEN_STATES]) },
        })
    }
}

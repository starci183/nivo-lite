import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import type { CreatedRow, MembershipRow } from "./persistence/workspaces.rows"
import { INSERT_FREE_WORKSPACE, LIST_MEMBERSHIPS } from "./persistence/workspaces.sql"
import type { CreatedWorkspace, WorkspaceMembership } from "./workspaces.contracts"
import type { WorkspacesOptions } from "./workspaces.options"
import { InjectWorkspacesOptions } from "./workspaces.port"

@Injectable()
/** The workspaces a person belongs to, and the creation of a free one where the environment allows it. */
export class WorkspacesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkspacesOptions() private readonly options: WorkspacesOptions,
    ) {}

    /** Every workspace the person belongs to, with their membership in it, oldest first. */
    async memberships(userId: string): Promise<ReadonlyArray<WorkspaceMembership>> {
        const rows = await this.entityManager.query<Array<MembershipRow>>(LIST_MEMBERSHIPS, [userId])
        return rows.map((row) => ({
            member: {
                userId: row.user_id,
                workspaceId: row.workspace_id,
                role: row.role,
                staffId: row.staff_id,
                displayName: row.display_name,
                status: row.status,
            },
            workspace: {
                id: row.workspace_id,
                name: row.workspace_name,
                status: row.workspace_status,
                ownerId: row.owner_id,
                createdAt: new Date(row.workspace_created_at).toISOString(),
                businessType: row.business_type,
            },
        }))
    }

    /** Creates a free workspace owned by the person; only where the environment allows it. */
    async createFree(userId: string, name: string): Promise<CreatedWorkspace> {
        if (!this.options.allowFreeWorkspace) throw new WorkspacesError({ code: WorkspacesErrorCode.SignupDisabled })
        const [created] = await this.entityManager.query<[CreatedRow]>(INSERT_FREE_WORKSPACE, [userId, name])
        return { id: created.id }
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import type {
    CreatedRow,
    MembershipRow,
    NamedWorkspaceRow,
    TakenRow,
    WorkspaceNameRow,
} from "./persistence/workspaces.rows"
import {
    FIND_WORKSPACE_NAME,
    FIND_NAMED_OWNED_WORKSPACE,
    HAS_ANY_WORKSPACE,
    INSERT_FREE_WORKSPACE,
    LIST_MEMBERSHIPS,
    LOCK_FIRST_WORKSPACE,
    SET_WORKSPACE_BRAND,
} from "./persistence/workspaces.sql"
import type { CreatedWorkspace, FirstWorkspace, WorkspaceBrand, WorkspaceMembership } from "./workspaces.contracts"
import type { WorkspacesOptions } from "./workspaces.options"
import { FIRST_WORKSPACE_NAME } from "./workspaces.templates"
import { InjectWorkspacesOptions } from "./workspaces.port"

@Injectable()
/** The workspaces a person belongs to, and the creation of a free one where the environment allows it. */
export class WorkspacesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkspacesOptions() private readonly options: WorkspacesOptions,
    ) {}

    /** The name of a workspace, or an empty text when there is no such workspace. */
    async nameOf(workspaceId: string): Promise<string> {
        const [row] = await this.entityManager.query<Array<WorkspaceNameRow>>(FIND_WORKSPACE_NAME, [workspaceId])
        return row?.name ?? ""
    }

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

    /** Ensures one explicitly named owned workspace under the existing per-owner creation lock. */
    ensureNamed(userId: string, name: string): Promise<CreatedWorkspace> {
        if (name.trim().length === 0 || name.length > 120)
            throw new WorkspacesError({ code: WorkspacesErrorCode.NameInvalid })
        return this.entityManager.transaction(async (tx) => {
            await tx.query(LOCK_FIRST_WORKSPACE, [userId])
            const found = await tx.query<Array<NamedWorkspaceRow>>(FIND_NAMED_OWNED_WORKSPACE, [userId, name])
            if (found.length > 1) throw new WorkspacesError({ code: WorkspacesErrorCode.NameAmbiguous })
            const existing = found[0]
            if (existing !== undefined && !existing.active)
                throw new WorkspacesError({ code: WorkspacesErrorCode.NameUnavailable })
            if (existing !== undefined) return { id: existing.id }
            if (!this.options.allowFreeWorkspace)
                throw new WorkspacesError({ code: WorkspacesErrorCode.SignupDisabled })
            const [created] = await tx.query<[CreatedRow]>(INSERT_FREE_WORKSPACE, [userId, name])
            return { id: created.id }
        })
    }

    /** Sets the brand of a workspace; only its owner may, and any other caller or workspace is refused as not found. */
    async setBrand(ownerId: string, workspaceId: string, brand: WorkspaceBrand): Promise<void> {
        const changed = await this.entityManager.query<Array<CreatedRow>>(SET_WORKSPACE_BRAND, [
            workspaceId,
            ownerId,
            brand.displayName,
            brand.logoUrl,
        ])
        if (changed.length === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
    }

    /**
     * The first sign-in of a person with no workspace at all, where free signup is allowed (local and demo): a new active workspace they
     * own (a trigger makes them its owner member). Nothing is created when signup is off or when they already own a workspace or hold
     * any membership (a disabled member is sent to the workspaces page, not given a new one). Concurrent first loads create one.
     */
    startFirst(userId: string): Promise<FirstWorkspace> {
        if (!this.options.allowFreeWorkspace) return Promise.resolve({ id: null })
        return this.entityManager.transaction(async (tx) => {
            await tx.query(LOCK_FIRST_WORKSPACE, [userId])
            const [row] = await tx.query<Array<TakenRow>>(HAS_ANY_WORKSPACE, [userId])
            if (row?.taken === true) return { id: null }
            const [created] = await tx.query<[CreatedRow]>(INSERT_FREE_WORKSPACE, [userId, FIRST_WORKSPACE_NAME])
            return { id: created.id }
        })
    }
}

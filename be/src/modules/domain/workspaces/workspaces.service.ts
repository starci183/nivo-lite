import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, advisoryXactLock } from "@modules/platform/database"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import type { CreatedWorkspace, FirstWorkspace, WorkspaceBrand, WorkspaceMembership } from "./workspaces.contracts"
import type { WorkspacesOptions } from "./workspaces.options"
import { FIRST_WORKSPACE_NAME } from "./workspaces.templates"
import { InjectWorkspacesOptions } from "./workspaces.port"

/** The most memberships one person reads. */
const MEMBERSHIPS_MAX = 500

/** A membership of the caller joined with its workspace, as the memberships read selects it. */
interface MembershipRaw {
    /** The workspace the membership belongs to. */
    readonly workspace_id: string
    /** The Auth user. */
    readonly user_id: string
    /** The staff row the account is, when it is one. */
    readonly staff_id: string | null
    /** The name Office and the decision history show. */
    readonly display_name: string
    /** Constrained by a CHECK in the table. */
    readonly role: "owner" | "manager" | "staff"
    /** Constrained by a CHECK in the table. */
    readonly status: "active" | "disabled"
    /** The workspace name. */
    readonly workspace_name: string
    /** The workspace status. */
    readonly workspace_status: string
    /** The Auth user who owns the workspace. */
    readonly owner_id: string
    /** When the workspace was created. */
    readonly workspace_created_at: Date
    /** The business type chosen at onboarding. */
    readonly business_type: string | null
}

/** An owned name remains discoverable while disabled, so ensure cannot create a duplicate. */
interface NamedWorkspaceRaw {
    /** The existing workspace identity. */
    readonly id: string
    /** True only when the workspace and owner seat remain active. */
    readonly active: boolean
}

@Injectable()
/** The workspaces a person belongs to, and the creation of a free one where the environment allows it. */
export class WorkspacesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkspacesOptions() private readonly options: WorkspacesOptions,
    ) {}

    /** The name of a workspace, or an empty text when there is no such workspace. */
    async nameOf(workspaceId: string): Promise<string> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { name: true },
            where: { id: workspaceId },
        })
        return row?.name ?? ""
    }

    /** Every workspace the person belongs to, with their membership in it, oldest first. */
    async memberships(userId: string): Promise<ReadonlyArray<WorkspaceMembership>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceEntity, "w")
            .innerJoin("workspace_members", "m", "m.workspace_id = w.id")
            .select("m.workspace_id", "workspace_id")
            .addSelect("m.user_id", "user_id")
            .addSelect("m.role", "role")
            .addSelect("m.staff_id", "staff_id")
            .addSelect("m.display_name", "display_name")
            .addSelect("m.status", "status")
            .addSelect("w.name", "workspace_name")
            .addSelect("w.status", "workspace_status")
            .addSelect("w.owner_id", "owner_id")
            .addSelect("w.created_at", "workspace_created_at")
            .addSelect("w.business_type", "business_type")
            .where("m.user_id = :userId", { userId })
            .orderBy("m.created_at", "ASC")
            .addOrderBy("m.id", "ASC")
            .limit(MEMBERSHIPS_MAX)
            .getRawMany<MembershipRaw>()
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
                createdAt: row.workspace_created_at.toISOString(),
                businessType: row.business_type,
            },
        }))
    }

    /** Creates a free workspace owned by the person; only where the environment allows it. */
    async createFree(userId: string, name: string): Promise<CreatedWorkspace> {
        if (!this.options.allowFreeWorkspace) throw new WorkspacesError({ code: WorkspacesErrorCode.SignupDisabled })
        return { id: await this.insertFree(this.entityManager, userId, name) }
    }

    /** Ensures one explicitly named owned workspace under the existing per-owner creation lock. */
    ensureNamed(userId: string, name: string): Promise<CreatedWorkspace> {
        if (name.trim().length === 0 || name.length > 120)
            throw new WorkspacesError({ code: WorkspacesErrorCode.NameInvalid })
        return this.entityManager.transaction(async (tx) => {
            await advisoryXactLock(tx, `workspace-first:${userId}`)
            const found = await tx
                .createQueryBuilder(WorkspaceEntity, "w")
                .leftJoin("workspace_members", "m", "m.workspace_id = w.id AND m.user_id = :userId", { userId })
                .select("w.id", "id")
                .addSelect(
                    "coalesce(w.status = 'active' AND m.role = 'owner' AND m.status = 'active', false)",
                    "active",
                )
                .where("w.owner_id = :userId AND w.name = :name", { userId, name })
                .limit(2)
                .getRawMany<NamedWorkspaceRaw>()
            if (found.length > 1) throw new WorkspacesError({ code: WorkspacesErrorCode.NameAmbiguous })
            const existing = found[0]
            if (existing !== undefined && !existing.active)
                throw new WorkspacesError({ code: WorkspacesErrorCode.NameUnavailable })
            if (existing !== undefined) return { id: existing.id }
            if (!this.options.allowFreeWorkspace)
                throw new WorkspacesError({ code: WorkspacesErrorCode.SignupDisabled })
            return { id: await this.insertFree(tx, userId, name) }
        })
    }

    /** Sets the brand of a workspace; only its owner may, and any other caller or workspace is refused as not found. */
    async setBrand(ownerId: string, workspaceId: string, brand: WorkspaceBrand): Promise<void> {
        const result = await this.entityManager.update(
            WorkspaceEntity,
            { id: workspaceId, ownerId },
            { displayName: brand.displayName, logoUrl: brand.logoUrl },
        )
        if ((result.affected ?? 0) === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
    }

    /**
     * The first sign-in of a person with no workspace at all, where free signup is allowed (local and demo): a new active workspace they
     * own (a trigger makes them its owner member). Nothing is created when signup is off or when they already own a workspace or hold
     * any membership (a disabled member is sent to the workspaces page, not given a new one). Concurrent first loads create one.
     */
    startFirst(userId: string): Promise<FirstWorkspace> {
        if (!this.options.allowFreeWorkspace) return Promise.resolve({ id: null })
        return this.entityManager.transaction(async (tx) => {
            await advisoryXactLock(tx, `workspace-first:${userId}`)
            if (await this.holdsAny(tx, userId)) return { id: null }
            return { id: await this.insertFree(tx, userId, FIRST_WORKSPACE_NAME) }
        })
    }

    /** Whether the person already owns a workspace or holds any membership, active or not. */
    private async holdsAny(manager: EntityManager, userId: string): Promise<boolean> {
        const member = await manager
            .createQueryBuilder()
            .select("1", "held")
            .from("workspace_members", "m")
            .where("m.user_id = :userId", { userId })
            .limit(1)
            .getRawOne<{ readonly held: number }>()
        return member !== undefined || (await manager.exists(WorkspaceEntity, { where: { ownerId: userId } }))
    }

    /** Creates a free active workspace and answers its id; a trigger makes the creator its owner member. */
    private async insertFree(manager: EntityManager, userId: string, name: string): Promise<string> {
        const result = await manager.insert(WorkspaceEntity, { ownerId: userId, name, status: "active" })
        const id = (result.identifiers[0] as { readonly id?: string } | undefined)?.id
        if (id === undefined) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return id
    }
}

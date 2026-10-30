import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager, advisoryXactLock } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import type { CreatedWorkspace, FirstWorkspace, NamedBusinessType, OptionalAccountId, WorkspaceBrand, WorkspaceMembership, WorkspaceName } from "./workspaces.contracts"
import type { WorkspacesOptions } from "./workspaces.options"
import { FIRST_WORKSPACE_NAME } from "./workspaces.templates"
import { InjectWorkspacesOptions } from "./workspaces.port"

/** The most memberships one person reads. */
const MEMBERSHIPS_MAX = 500

@Injectable()
/** The workspaces a person belongs to, and the creation of a free one where the environment allows it. */
export class WorkspacesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkspacesOptions() private readonly options: WorkspacesOptions,
        private readonly members: WorkspaceMemberDirectoryService,
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
        const seats = await this.members.seatsOf(userId, MEMBERSHIPS_MAX)
        if (seats.length === 0) return []
        const found = await this.entityManager.find(WorkspaceEntity, {
            where: { id: In(seats.map((seat) => seat.workspaceId)) },
            take: seats.length,
        })
        const byId = new Map(found.map((workspace) => [workspace.id, workspace]))
        return seats.flatMap((member) => {
            const workspace = byId.get(member.workspaceId)
            if (workspace === undefined) return []
            return [
                {
                    member,
                    workspace: {
                        id: workspace.id,
                        name: workspace.name,
                        status: workspace.status,
                        ownerId: workspace.ownerId,
                        createdAt: workspace.createdAt.toISOString(),
                        businessType: workspace.businessType,
                    },
                },
            ]
        })
    }

    /** Every workspace by id, bounded: its id and name. */
    async list(limit: number): Promise<ReadonlyArray<WorkspaceName>> {
        const rows = await this.entityManager.find(WorkspaceEntity, {
            select: { id: true, name: true },
            order: { id: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ id: row.id, name: row.name }))
    }

    /** The accounts that own any of the workspaces, each once, in id order, bounded. */
    async ownerIdsOf(workspaceIds: ReadonlyArray<string>, limit: number): Promise<ReadonlyArray<string>> {
        if (workspaceIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceEntity, "w")
            .select("w.ownerId", "owner_id")
            .distinct(true)
            .where("w.id IN (:...workspaceIds)", { workspaceIds: [...workspaceIds] })
            .orderBy("w.ownerId")
            .limit(limit)
            .getRawMany<{ readonly owner_id: string }>()
        return rows.map((row) => row.owner_id)
    }

    /** The account that owns the workspace, or none when there is no such workspace. */
    async ownerIdOf(workspaceId: string): Promise<OptionalAccountId> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { ownerId: true },
            where: { id: workspaceId },
        })
        return row?.ownerId ?? null
    }

    /** Creates a free workspace owned by the person; only where the environment allows it. */
    async createFree(
        userId: string,
        name: string,
        businessType: NamedBusinessType = null,
    ): Promise<CreatedWorkspace> {
        if (!this.options.allowFreeWorkspace) throw new WorkspacesError({ code: WorkspacesErrorCode.SignupDisabled })
        return { id: await this.insertFree(this.entityManager, userId, name, businessType) }
    }

    /** Ensures one explicitly named owned workspace under the existing per-owner creation lock. */
    ensureNamed(userId: string, name: string): Promise<CreatedWorkspace> {
        if (name.trim().length === 0 || name.length > 120)
            throw new WorkspacesError({ code: WorkspacesErrorCode.NameInvalid })
        return this.entityManager.transaction(async (tx) => {
            await advisoryXactLock(tx, `workspace-first:${userId}`)
            const found = await tx.find(WorkspaceEntity, {
                select: { id: true, status: true },
                where: { ownerId: userId, name },
                take: 2,
            })
            if (found.length > 1) throw new WorkspacesError({ code: WorkspacesErrorCode.NameAmbiguous })
            const existing = found[0]
            if (existing !== undefined && !(await this.isActiveOwned(tx, existing, userId)))
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
        return (
            (await this.members.holdsAny(userId, manager)) ||
            (await manager.exists(WorkspaceEntity, { where: { ownerId: userId } }))
        )
    }

    /** True only when the workspace and the owner seat of the person remain active. */
    private async isActiveOwned(
        manager: EntityManager,
        workspace: Pick<WorkspaceEntity, "id" | "status">,
        userId: string,
    ): Promise<boolean> {
        return workspace.status === "active" && (await this.members.isActiveOwner(workspace.id, userId, manager))
    }

    /** Creates a free active workspace, with the business type when one was named, and answers its id; a trigger makes the creator its owner member. */
    private async insertFree(
        manager: EntityManager,
        userId: string,
        name: string,
        businessType: NamedBusinessType = null,
    ): Promise<string> {
        const result = await manager.insert(WorkspaceEntity, {
            ownerId: userId,
            name,
            status: "active",
            ...(businessType === null ? {} : { businessType }),
        })
        const [created] = result.identifiers
        if (!isRecord(created) || typeof created.id !== "string")
            throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return created.id
    }
}

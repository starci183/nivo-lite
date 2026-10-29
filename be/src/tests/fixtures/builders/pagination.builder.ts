import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { eachInOrder } from "@modules/platform/primitives"
import { leadsEntities } from "@modules/domain/leads"
import { ordersEntities } from "@modules/domain/orders"
import { workThreadsEntities } from "@modules/domain/work-threads"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkThreadEntity] = workThreadsEntities

const [WorkspaceEntity] = workspacesEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities
const [OrderEntity] = ordersEntities

const [LeadEntity] = leadsEntities

/** The identities of one isolated pagination proof. */
export interface PaginationIdentity {
    /** The account owning the workspaces. */
    readonly userId: string
    /** The populated workspace. */
    readonly workspaceId: string
    /** Another populated workspace whose rows must never join this one's pages. */
    readonly foreignWorkspaceId: string
    /** A workspace without list rows. */
    readonly emptyWorkspaceId: string
    /** Oldest, two rows at the same instant, and newest. */
    readonly rowIds: readonly [string, string, string, string]
    /** The one row of the foreign workspace. */
    readonly foreignRowId: string
}

/** The persisted proof and the workspace member who created its threads. */
export interface PaginationFixture extends PaginationIdentity {
    /** The owning account's member id in the populated workspace. */
    readonly creatorMemberId: string
}

const ownerMemberId = async (manager: EntityManager, workspaceId: string, userId: string): Promise<string> => {
    const row = await manager.findOne(WorkspaceMemberEntity, { where: { workspaceId, userId }, select: { id: true } })
    assert(row, "The pagination workspace must have its owner's member row")
    return row.id
}

const TIMES = [
    "2026-01-01T00:00:00.123455+00:00",
    "2026-01-01T00:00:00.123456+00:00",
    "2026-01-01T00:00:00.123456+00:00",
    "2026-01-01T00:00:00.123457+00:00",
] as const

/** Adds the same identity to each list, preserving the database's six fractional timestamp digits. */
export const persistPaginationRow = async (
    manager: EntityManager,
    workspaceId: string,
    rowId: string,
    createdAt: string,
    leadId: string,
    createdBy: string,
): Promise<void> => {
    await manager.insert(LeadEntity, {
        id: rowId,
        workspaceId: workspaceId,
        contactName: `Pagination ${rowId}`,
        company: "",
        channel: "web",
        need: "Cursor proof",
        createdAt: createdAt,
    })
    await manager.insert(OrderEntity, {
        id: rowId,
        workspaceId: workspaceId,
        leadId: leadId,
        orderNo: `pagination-${rowId}`,
        createdAt: createdAt,
    })
    await manager.insert(WorkThreadEntity, {
        id: rowId,
        workspaceId: workspaceId,
        leadId: leadId,
        title: `Pagination ${rowId}`,
        createdBy: createdBy,
        createdAt: createdAt,
        updatedAt: createdAt,
    })
}

/** Persists tied instants and adjacent microseconds in each workspace list. */
export const persistPaginationRows = (
    manager: EntityManager,
    identity: PaginationIdentity,
): Promise<PaginationFixture> =>
    manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: identity.userId })
        await eachInOrder(
            [identity.workspaceId, identity.foreignWorkspaceId, identity.emptyWorkspaceId],
            async (workspaceId) => {
                await tx.insert(WorkspaceEntity, {
                    id: workspaceId,
                    ownerId: identity.userId,
                    name: "Pagination proof",
                })
            },
        )
        const creatorMemberId = await ownerMemberId(tx, identity.workspaceId, identity.userId)
        const foreignMemberId = await ownerMemberId(tx, identity.foreignWorkspaceId, identity.userId)
        await eachInOrder(identity.rowIds, async (id, index) => {
            await persistPaginationRow(
                tx,
                identity.workspaceId,
                id,
                TIMES[index] ?? TIMES[0],
                identity.rowIds[0],
                creatorMemberId,
            )
        })
        await persistPaginationRow(
            tx,
            identity.foreignWorkspaceId,
            identity.foreignRowId,
            TIMES[3],
            identity.foreignRowId,
            foreignMemberId,
        )
        return { ...identity, creatorMemberId }
    })

/** Inserts newer list rows and changes the oldest thread's activity time between two page reads. */
export const persistPaginationChange = (
    manager: EntityManager,
    fixture: PaginationFixture,
    newerId: string,
): Promise<void> =>
    manager.transaction(async (tx) => {
        await persistPaginationRow(
            tx,
            fixture.workspaceId,
            newerId,
            "2026-01-01T00:00:00.123458+00:00",
            fixture.rowIds[0],
            fixture.creatorMemberId,
        )
        await tx.update(
            WorkThreadEntity,
            { id: fixture.rowIds[0], workspaceId: fixture.workspaceId },
            { updatedAt: "2026-01-02T00:00:00+00:00" },
        )
    })
